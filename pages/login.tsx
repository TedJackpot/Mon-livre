import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft, LockKeyhole } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import styles from "./login.module.css";

export default function LoginPage() {
  const [registering, setRegistering] = useState(false);
  return <main className={styles.page}>
    <Link to="/" className={styles.back}><ChevronLeft size={15}/> Retour à l’atelier</Link>
    <section className={styles.card}>
      <Link to="/" className={styles.logo}><span><BookOpen size={20}/></span> Mon Livre</Link>
      <div className={styles.icon}><LockKeyhole size={18}/></div>
      <small className={styles.kicker}>VOTRE ESPACE ÉDITORIAL</small>
      <h1>{registering ? "Créer votre compte" : "Ravi de vous retrouver"}</h1>
      <p>{registering ? "Gardez vos livres et vos idées au même endroit." : "Connectez-vous pour retrouver vos projets enregistrés."}</p>
      {registering ? <PasswordRegisterForm/> : <PasswordLoginForm/>}
      <div className={styles.switch}>{registering ? "Vous avez déjà un compte ?" : "Vous découvrez Mon Livre ?"} <button onClick={() => setRegistering(!registering)}>{registering ? "Se connecter" : "Créer un compte"}</button></div>
      <div className={styles.privacy}>Vos projets sont privés et accessibles uniquement depuis votre compte.</div>
    </section>
    <div className={styles.foot}>MON LIVRE <span>·</span> CRÉER, COMPOSER, TRANSMETTRE</div>
  </main>;
}