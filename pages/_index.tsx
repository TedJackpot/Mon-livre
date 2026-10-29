import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Image as ImageIcon, LayoutTemplate, LogIn, MoreHorizontal, Plus, Save, Sparkles, Trash2, Type, Upload, X } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import superjson from "superjson";
import styles from "./_index.module.css";

type Page = { id: string; heading: string; text: string; image?: string; layout: string; color: string; bookmark: boolean };
type Book = { id?: string; title: string; subtitle: string; author: string; cover: string; font: string; pages: Page[] };
const createPage = (): Page => ({ id: crypto.randomUUID(), heading: "Nouveau chapitre", text: "", layout: "image-right", color: "#fffdf8", bookmark: false });
const initialBook = (): Book => ({ title: "Mon premier livre", subtitle: "Une histoire à composer", author: "", cover: "classic", font: "newsreader", pages: [{ ...createPage(), heading: "Le début de votre histoire", text: "Ajoutez ici votre texte, puis donnez-lui la forme d’un livre. Importez vos images, choisissez une maquette et ajustez chaque détail." }] });
const models = [["image-right", "Image à droite", "Récit illustré"], ["image-top", "Image en tête", "Album photo"], ["text-only", "Page texte", "Chapitre"], ["full-image", "Image pleine page", "Planche"]];
const colors = ["#fffdf8", "#f5e9de", "#edf0e7", "#f2e5e3", "#e9edf1"];

export default function HomePage() {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const [book, setBook] = useState<Book>(initialBook);
  const [index, setIndex] = useState(0);
  const [panel, setPanel] = useState("layout");
  const [projects, setProjects] = useState<Array<{id:string;title:string}>>([]);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const page = book.pages[index] || book.pages[0];
  const count = book.pages.length;
  useEffect(() => {
    if (!user) return;
    fetch("/_api/books", { credentials: "include" }).then(async r => r.ok ? superjson.parse<{projects:Array<{id:string;title:string}>}>(await r.text()) : {projects:[]}).then(d => setProjects(d.projects || [])).catch(() => setProjects([]));
  }, [user?.id]);
  const updatePage = (change: Partial<Page>) => { setBook(b => ({...b,pages:b.pages.map((p,i) => i === index ? {...p,...change} : p)})); setSaved(false); };
  const updateBook = (change: Partial<Book>) => { setBook(b => ({...b,...change})); setSaved(false); };
  const addPage = () => { setBook(b => ({...b,pages:[...b.pages,createPage()]})); setIndex(count); setSaved(false); };
  const importImage = async (file?: File) => {
    if (!file) return; setError(""); setBusy(true);
    try {
      const data = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error("Lecture de l’image impossible."));
        reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error("Format d’image non reconnu."));
          image.onload = () => { const scale = Math.min(1,1400/Math.max(image.width,image.height)); const canvas=document.createElement("canvas"); canvas.width=image.width*scale; canvas.height=image.height*scale; const ctx=canvas.getContext("2d"); if(!ctx) return reject(new Error("Traitement d’image indisponible.")); ctx.drawImage(image,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL("image/jpeg",.76)); }; image.src=String(reader.result); };
        reader.readAsDataURL(file);
      });
      updatePage({image:data}); setPanel("images"); setNotice("Image ajoutée au livre.");
    } catch(e) { setError(e instanceof Error ? e.message : "Import impossible."); }
    finally { setBusy(false); if(imageRef.current) imageRef.current.value=""; }
  };
  const importText = async (file?: File) => {
    if (!file) return; setBusy(true); setError("");
    try { const text=await file.text(); const blocks=text.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean); if(!blocks.length) throw new Error("Ce fichier ne contient pas de texte.");
      const pages=blocks.map((content,i)=>({...createPage(),heading:i===0?file.name.replace(/\.[^.]+$/,""):"Passage "+(i+1),text:content}));
      setBook(b=>({...b,pages}));setIndex(0);setSaved(false);setNotice(blocks.length+" passages importés.");
    } catch(e) { setError(e instanceof Error ? e.message : "Import impossible."); } finally { setBusy(false); if(textRef.current) textRef.current.value=""; }
  };
  const save = async () => {
    if (!user) { setNotice("Connectez-vous ou créez un compte pour conserver ce livre."); return; }
    setBusy(true);setError("");setNotice("");
    try {
      const pages=[];
      for(const p of book.pages){
        if(p.image&&p.image.startsWith("data:image/jpeg;base64,")){
          const imageId=crypto.randomUUID();
          const upload=await fetch("/_api/book-image",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify({id:imageId,dataUrl:p.image})});
          const asset=superjson.parse<{error?:string;path?:string}>(await upload.text());
          if(!upload.ok||!asset.path)throw new Error(asset.error||"Impossible d’enregistrer une image.");
          pages.push({...p,image:asset.path});
        }else pages.push(p);
      }
      const doc={...book,id:book.id||crypto.randomUUID(),pages};
      const r=await fetch("/_api/books/save",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(doc)});
      const d=superjson.parse<{error?:string}>(await r.text());
      if(!r.ok)throw new Error(d.error||"Sauvegarde impossible.");
      setBook(doc);setSaved(true);setProjects(p=>[{id:doc.id!,title:doc.title},...p.filter(x=>x.id!==doc.id)]);setNotice("Projet enregistré dans votre espace.");
    }
    catch(e){setError(e instanceof Error?e.message:"Sauvegarde impossible.");}finally{setBusy(false);}
  };
  const open = async (id:string) => { setBusy(true);try{const r=await fetch("/_api/books/open",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify({id})});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error||"Ouverture impossible.");setBook({...d.document,id:d.id});setIndex(0);setSaved(true);setNotice("Projet ouvert.");}catch(e){setError(e instanceof Error?e.message:"Ouverture impossible.");}finally{setBusy(false);} };
  const download = () => { const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:"application/json"}));a.download=(book.title||"mon-livre")+".json";a.click(); };
  const printBook = () => {
    const popup = window.open("", "_blank");
    if (!popup) { setError("Autorisez l’ouverture de la fenêtre d’impression dans votre navigateur."); return; }
    const escape = (value:string) => value.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch] || ch));
    const cover = '<section class="cover"><small>MON LIVRE</small><h1>'+escape(book.title)+'</h1><p>'+escape(book.subtitle)+'</p><footer>'+escape(book.author||"")+'</footer></section>';
    const pages = book.pages.map((p,i) => {
      const safeImage = p.image && (p.image.startsWith("data:image/jpeg;base64,") || /^\/_api\/book-image\?id=[A-Za-z0-9-]{8,80}$/.test(p.image)) ? p.image : "";
      const image = safeImage ? '<img src="'+safeImage+'" alt="">' : "";
      return '<section class="page"><header>MON LIVRE <span>'+String(i+1).padStart(2,"0")+'</span></header><h2>'+escape(p.heading)+'</h2><div class="copy">'+escape(p.text).replace(/\n/g,"<br>")+'</div>'+image+'<footer>'+String(i+1)+'</footer></section>';
    }).join("");
    popup.document.open();
    popup.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>'+escape(book.title)+'</title><style>@import url(https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Instrument+Serif&display=swap);*{box-sizing:border-box}body{margin:0;color:#302822;font-family:Georgia,serif}.cover,.page{width:148mm;height:210mm;margin:0 auto;padding:18mm;page-break-after:always;position:relative;background:#fffdf8}.cover{background:#78564b;color:#fff4e6;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center}.cover:before{content:"";position:absolute;inset:10mm;border:1px solid #fff6}.cover small{font:9px Arial;letter-spacing:.2em}.cover h1{font:42px Georgia;margin:24mm 0 5mm}.cover p{font:13px Arial}.cover footer{position:absolute;bottom:20mm}.page header{display:flex;justify-content:space-between;border-bottom:1px solid #ddd4ca;padding-bottom:4mm;font:8px Arial;letter-spacing:.15em;color:#8b7d70}.page h2{font:34px Georgia;margin:20mm 0 9mm}.copy{font:14px/1.8 Georgia;white-space:normal}.page img{display:block;max-width:100%;max-height:82mm;object-fit:contain;margin:10mm auto}.page footer{position:absolute;bottom:12mm;right:18mm;color:#8b7d70;font-size:10px}@page{size:A5;margin:0}@media screen{body{background:#ddd4ca;padding:15px}.cover,.page{box-shadow:0 3px 20px #0002;margin:15px auto}}@media print{body{background:white}}</style></head><body>'+cover+pages+'</body></html>');
    popup.document.close();
    window.setTimeout(() => { popup.focus(); popup.print(); }, 500);
  };
  return <main className={styles.app}>
    <header className={styles.topbar}><Link to="/" className={styles.brand}><span><BookOpen size={18}/></span><b>Mon Livre<small>STUDIO ÉDITORIAL</small></b></Link><div className={styles.projectName}><i/>{book.title}<ChevronDown size={14}/></div><div className={styles.topActions}>{notice&&<span className={styles.notice}>{notice}</span>}<button className={styles.iconButton} onClick={download} title="Télécharger"><Download size={17}/></button>{user?<span className={styles.user}>{user.displayName.slice(0,1).toUpperCase()}</span>:<Link className={styles.login} to="/login"><LogIn size={15}/> Se connecter</Link>}<button className={styles.save} onClick={save} disabled={busy}><Save size={15}/>{busy?"Enregistrement…":saved?"Enregistré":"Enregistrer"}</button></div></header>
    <div className={styles.workspace}>
      <aside className={styles.rail}><label>VOTRE LIVRE</label>{[["layout","Maquettes",<LayoutTemplate size={17}/>],["text","Textes",<Type size={17}/>],["images","Images",<ImageIcon size={17}/>],["cover","Couverture",<BookOpen size={17}/>],["catalogues","Modèles gratuits",<Sparkles size={17}/>]].map(([id,name,icon])=><button key={String(id)} className={[styles.railButton,panel===id?styles.active:""].join(" ")} onClick={()=>setPanel(String(id))}>{icon}<span>{name}</span></button>)}<hr/><label>MES PROJETS</label>{user?projects.map(p=><button className={styles.projectRow} key={p.id} onClick={()=>open(p.id)}><FileText size={14}/>{p.title}</button>):<p className={styles.hint}>Connectez-vous pour retrouver vos projets.</p>}<div className={styles.profile}>{user?.displayName||"Espace créateur"}<small>{user?"Compte actif":"Mode découverte"}</small></div></aside>
      <section className={styles.editor}><div className={styles.editorTitle}><div><small>ATELIER DE MISE EN PAGE</small><h1>{book.title}</h1></div><span>● Modifications locales <MoreHorizontal size={18}/></span></div>
        {error&&<div className={styles.error}><X size={15}/>{error}</div>}
        <div className={styles.toolbar}><div><button onClick={()=>setPanel("layout")}><LayoutTemplate size={15}/> Modèle</button><button onClick={()=>setPanel("text")}><Type size={15}/> Texte</button><button onClick={()=>imageRef.current?.click()}><ImageIcon size={15}/> Image</button><input ref={imageRef} type="file" accept="image/*" hidden onChange={e=>importImage(e.target.files?.[0])}/></div><span>{String(index+1).padStart(2,"0")} / {String(count).padStart(2,"0")} <button onClick={()=>setIndex(Math.max(0,index-1))} disabled={!index}><ChevronLeft size={17}/></button><button onClick={()=>setIndex(Math.min(count-1,index+1))} disabled={index===count-1}><ChevronRight size={17}/></button></span></div>
        <div className={styles.stage}><div className={styles.spread}><div className={styles.paper} style={{background:page.color}}><div className={styles.paperTop}><span>MON LIVRE</span><span>{String(index+1).padStart(2,"0")}</span></div>{page.layout==="full-image"&&page.image&&<img className={styles.full} src={page.image}/>}<input className={styles.heading} value={page.heading} onChange={e=>updatePage({heading:e.target.value})} placeholder="Titre du chapitre"/>{page.layout!=="full-image"&&<textarea className={styles.body} value={page.text} onChange={e=>updatePage({text:e.target.value})} placeholder="Écrivez ou collez votre texte ici…"/>}<small className={styles.pageNo}>{index+1}</small></div><div className={styles.spine}/><div className={styles.illustration}>{page.image&&page.layout!=="full-image"?<img src={page.image} alt="Illustration importée"/>:<button className={styles.drop} onClick={()=>imageRef.current?.click()}><span><ImageIcon size={22}/></span><b>Ajouter une illustration</b><small>PNG, JPG ou image générée</small><em><Upload size={13}/> Importer une image</em></button>}{page.bookmark&&<i className={styles.ribbon}/>}<button className={styles.mark} onClick={()=>updatePage({bookmark:!page.bookmark})} title="Marque-page"><Bookmark size={15} fill={page.bookmark?"currentColor":"none"}/></button>{page.image&&<button className={styles.remove} onClick={()=>updatePage({image:undefined})}><X size={15}/></button>}</div></div></div>
        <div className={styles.pages}><span>VOS PAGES<small>{count} page{count>1?"s":""}</small></span><div className={styles.thumbs}>{book.pages.map((p,i)=><button key={p.id} onClick={()=>setIndex(i)} className={[styles.thumb,i===index?styles.thumbOn:""].join(" ")}><i>{p.image?<img src={p.image}/>:null}</i><b>{String(i+1).padStart(2,"0")}</b></button>)}</div><button className={styles.add} onClick={addPage}><Plus size={15}/> Ajouter une page</button></div>
      </section>
      <aside className={styles.inspector}><small className={styles.overline}>PERSONNALISATION</small><h2>{panel==="layout"?"Mise en page":panel==="text"?"Typographie":panel==="images"?"Bibliothèque":panel==="catalogues"?"Bibliothèques gratuites":"Couverture"}</h2>
        {panel==="layout"&&<><label>CHOISIR UNE MAQUETTE</label><div className={styles.models}>{models.map(([id,name,desc])=><button key={id} className={page.layout===id?styles.chosen:""} onClick={()=>updatePage({layout:id})}><i className={styles[id as string]}><b/></i><strong>{name}</strong><small>{desc}</small>{page.layout===id&&<Check size={13}/>}</button>)}</div><label>AMBIANCE DE PAGE</label><div className={styles.swatches}>{colors.map(c=><button key={c} style={{background:c}} className={page.color===c?styles.selectedSwatch:""} onClick={()=>updatePage({color:c})}/>)}</div><label>OUTILS DE PAGE</label><button className={styles.action} onClick={()=>{if(count>1){setBook(b=>({...b,pages:b.pages.filter((_,i)=>i!==index)}));setIndex(Math.max(0,index-1));setSaved(false);}}} disabled={count<2}><Trash2 size={15}/> Supprimer cette page</button><button className={styles.action} onClick={()=>{const p={...page,id:crypto.randomUUID()};setBook(b=>({...b,pages:[...b.pages.slice(0,index+1),p,...b.pages.slice(index+1)]}));setIndex(index+1);setSaved(false);}}><Plus size={15}/> Dupliquer cette page</button></>}
        {panel==="text"&&<><label>IMPORTER UN TEXTE</label><button className={styles.upload} onClick={()=>textRef.current?.click()}><Upload size={18}/><b>Importer un fichier .txt ou .md</b><small>Les paragraphes seront répartis sur des pages.</small></button><input ref={textRef} type="file" accept=".txt,.md,text/plain" hidden onChange={e=>importText(e.target.files?.[0])}/><label>STYLE DU TEXTE</label>{[["newsreader","Édition littéraire"],["classic","Classique"]].map(([id,name])=><button className={styles.choice} key={id} onClick={()=>updateBook({font:id})}>{name}<span>{book.font===id?"✓":""}</span></button>)}<label>TITRE DE PAGE</label><input className={styles.field} value={page.heading} onChange={e=>updatePage({heading:e.target.value})}/></>}
        {panel==="images"&&<><label>VOTRE BIBLIOTHÈQUE</label><button className={styles.upload} onClick={()=>imageRef.current?.click()}><Upload size={18}/><b>Importer une image</b><small>Choisissez une illustration déjà créée.</small></button>{page.image&&<div className={styles.asset}><img src={page.image}/><span>Image de la page {index+1}</span><button onClick={()=>updatePage({image:undefined})}><Trash2 size={14}/></button></div>}<p className={styles.tip}>Vos images sont ajustées à la page et enregistrées avec le projet.</p></>}
        {panel==="cover"&&<><label>VOTRE COUVERTURE</label><a className={styles.adobeButton} href="https://www.adobe.com/fr/express/templates/cover" target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Explorer Adobe Express · gratuit</a><a className={styles.adobeButton} href="https://www.canva.com/book-covers/templates/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Explorer Canva · gratuit</a><div className={[styles.cover,styles["cover_"+book.cover]].join(" ")}><small>MON LIVRE</small><input value={book.title} onChange={e=>updateBook({title:e.target.value})}/><input value={book.subtitle} onChange={e=>updateBook({subtitle:e.target.value})}/><span>{book.author||"Votre nom"}</span></div><label>MODÈLE DE COUVERTURE</label>{[["classic","Classique"],["atelier","Atelier"],["botanical","Botanique"]].map(([id,name])=><button className={styles.choice} key={id} onClick={()=>updateBook({cover:id})}>{name}<span>{book.cover===id?"✓":""}</span></button>)}<label>AUTEUR·RICE</label><input className={styles.field} placeholder="Votre nom" value={book.author} onChange={e=>updateBook({author:e.target.value})}/></>}
        {panel==="catalogues"&&<><p className={styles.catalogueIntro}>Des milliers de modèles sont consultables gratuitement sur ces plateformes. Ouvre une bibliothèque, choisis un modèle marqué « gratuit », puis exporte-le pour l’utiliser dans ton livre.</p><a className={styles.catalogueCard} href="https://www.canva.com/photo-books/templates/" target="_blank" rel="noopener noreferrer"><b>Canva · Livres photo</b><small>Albums, voyages, famille, mariage et portfolio. Les modèles restent éditables dans Canva.</small><span>Ouvrir le catalogue <ExternalLink size={13}/></span></a><a className={styles.catalogueCard} href="https://www.canva.com/book-covers/templates/" target="_blank" rel="noopener noreferrer"><b>Canva · Couvertures</b><small>Couvertures de romans, albums photo, recettes et journaux.</small><span>Ouvrir le catalogue <ExternalLink size={13}/></span></a><a className={styles.catalogueCard} href="https://www.adobe.com/express/templates/book" target="_blank" rel="noopener noreferrer"><b>Adobe Express · Livres</b><small>Modèles gratuits et modifiables, avec filtre gratuit sur la bibliothèque.</small><span>Ouvrir le catalogue <ExternalLink size={13}/></span></a><a className={styles.catalogueCard} href="https://www.adobe.com/express/templates/cover" target="_blank" rel="noopener noreferrer"><b>Adobe Express · Couvertures</b><small>Couvertures de livre personnalisables dans Adobe Express.</small><span>Ouvrir le catalogue <ExternalLink size={13}/></span></a><p className={styles.catalogueNote}>Les catalogues changent régulièrement. Vérifie le badge « gratuit » avant d’ouvrir ou d’exporter un modèle. Les éléments Canva/Adobe ne sont pas téléchargés en lot dans Mon Livre ; cela évite de redistribuer des contenus protégés ou premium.</p></>}
        <div className={styles.inspectorBottom}><span><Check size={13}/> {saved?"Modifications enregistrées":"Enregistrement à la demande"}</span><button onClick={save} disabled={busy}><Save size={14}/> Enregistrer le projet</button></div>
      </aside>
    </div><footer className={styles.footer}><span>{book.pages.reduce((n,p)=>n+(p.text.trim()?p.text.trim().split(/\s+/).length:0),0)} mots · {count} page{count>1?"s":""}</span><div><button onClick={download}><Download size={14}/> Exporter JSON</button><button onClick={printBook}><FileText size={14}/> Imprimer / PDF</button></div></footer>
    {!user&&notice.includes("Connectez-vous")&&<div className={styles.popover}><button onClick={()=>setNotice("")}><X size={14}/></button><b>Retrouvez votre livre plus tard</b><small>Créez un compte pour sauvegarder vos projets.</small><Link to="/login">Créer un compte ou se connecter <ChevronRight size={14}/></Link></div>}
  </main>;
}