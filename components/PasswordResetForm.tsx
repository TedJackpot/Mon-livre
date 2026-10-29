import React, { useState } from "react";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import styles from "./PasswordResetForm.module.css";
import {
  schema as requestSchema,
  postRequestPasswordReset,
} from "../endpoints/auth/request_password_reset_POST.schema";
import { postResetPassword } from "../endpoints/auth/reset_password_POST.schema";

const codeSchema = z.object({
  code: z.string().trim().min(1, "Enter the code from the email"),
  newPassword: z.string().min(8, "Use at least 8 characters"),
  confirmPassword: z.string().min(1, "Repeat the new password"),
});

interface PasswordResetFormProps {
  className?: string;
  defaultEmail?: string;
  /** Called after the password was changed (e.g. go back to the login form). */
  onDone: () => void;
  onCancel: () => void;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  className,
  defaultEmail = "",
  onDone,
  onCancel,
}) => {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm({
    defaultValues: { email: defaultEmail },
    schema: requestSchema,
  });
  const codeForm = useForm({
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
    schema: codeSchema,
  });

  const sendCode = async (email: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await postRequestPasswordReset({ email });
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’envoyer le code.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: z.infer<typeof codeSchema>) => {
    if (!sentTo) return;
    if (data.newPassword !== data.confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await postResetPassword({
        email: sentTo,
        code: data.code,
        newPassword: data.newPassword,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le mot de passe.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!sentTo) {
    return (
      <Form {...emailForm}>
        <form
          onSubmit={emailForm.handleSubmit((data) => sendCode(data.email))}
          className={`${styles.form} ${className || ""}`}
        >
          <p className={styles.intro}>
            Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un code pour choisir un nouveau mot de passe.
          </p>
          {error && <div className={styles.errorMessage}>{error}</div>}
          <FormItem name="email">
          <FormLabel>Adresse e-mail</FormLabel>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
              placeholder="vous@exemple.fr"
                disabled={isLoading}
                value={emailForm.values.email}
                onChange={(e) =>
                  emailForm.setValues((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
          <Button type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading ? "Envoi…" : "Envoyer le code"}
          </Button>
          <button type="button" className={styles.linkButton} onClick={onCancel}>
            Retour à la connexion
          </button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...codeForm}>
      <form
        onSubmit={codeForm.handleSubmit(resetPassword)}
        className={`${styles.form} ${className || ""}`}
      >
        <p className={styles.intro}>
          Si un compte existe pour {sentTo}, un code vient d’être envoyé. Il expire dans 15 minutes.
        </p>
        {error && <div className={styles.errorMessage}>{error}</div>}
        <FormItem name="code">
          <FormLabel>Code reçu par e-mail</FormLabel>
          <FormControl>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="12345678"
              disabled={isLoading}
              value={codeForm.values.code}
              onChange={(e) =>
                codeForm.setValues((prev) => ({ ...prev, code: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="newPassword">
          <FormLabel>Nouveau mot de passe</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              value={codeForm.values.newPassword}
              onChange={(e) =>
                codeForm.setValues((prev) => ({ ...prev, newPassword: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="confirmPassword">
          <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              value={codeForm.values.confirmPassword}
              onChange={(e) =>
                codeForm.setValues((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <Button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? "Enregistrement…" : "Définir le mot de passe"}
        </Button>
        <button
          type="button"
          className={styles.linkButton}
          disabled={isLoading}
          onClick={() => sendCode(sentTo)}
        >
          Renvoyer un code
        </button>
        <button type="button" className={styles.linkButton} onClick={onCancel}>
          Retour à la connexion
        </button>
      </form>
    </Form>
  );
};
