import styles from './Auth.module.css'

// Marco visual común de las pantallas públicas (login y recuperación de
// contraseña): panel de marca a la izquierda y formulario a la derecha.
export default function AuthShell({ children }) {
  return (
    <div className={styles.loginContainer}>
      <div className={styles.leftBanner}>
        <svg className={styles.blobShape} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,0 L78,0 C66,12 94,24 76,40 C62,54 96,64 72,80 C60,90 88,95 64,100 L0,100 Z" />
        </svg>

        <div className={styles.blobDotLg} aria-hidden="true" />
        <div className={styles.blobDotSm} aria-hidden="true" />

        <div className={styles.bannerContent}>
          <div className={styles.doodle}>
            <span className={styles.doodleText}>Del hilo a la entrega.</span>
            <svg className={styles.doodleSwoosh} viewBox="0 0 120 14" aria-hidden="true">
              <path
                d="M2,8 C25,2 45,13 68,6 C85,1 100,9 118,4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className={styles.logo}>
            <svg className={styles.logoMark} viewBox="0 0 48 32" aria-hidden="true">
              <circle cx="16" cy="16" r="14" fill="#ffffff" />
              <circle cx="32" cy="16" r="14" fill="none" stroke="#4fe0cd" strokeWidth="3" />
            </svg>
            <span className={styles.logoText}>
              TexCore<span className={styles.logoAccent}>ERP</span>
            </span>
          </div>

          <h1 className={styles.bannerTitle}>
            Produce.
            <br />
            Rastrea. <span className={styles.bannerAccent}>Entrega.</span>
          </h1>
          <p className={styles.bannerText}>
            Gestiona proveedores, producción y despachos de tu confección de jeans en un solo lugar, con trazabilidad
            real de cada lote.
          </p>
          <div className={styles.footerText}>© 2026 TexCoreERP. Todos los derechos reservados.</div>
        </div>
      </div>

      <div className={styles.rightForm}>
        <div className={styles.cornerBlob} aria-hidden="true" />
        <div className={styles.cornerBlobSm} aria-hidden="true" />
        <div className={styles.cornerDoodle} aria-hidden="true">
          <span className={styles.cornerDoodleText}>
            Cero enredos,
            <br />
            cero retrasos.
          </span>
          <svg className={styles.cornerDoodleArrow} viewBox="0 0 60 60" aria-hidden="true">
            <path
              d="M50,6 C55,22 50,36 36,46 M36,46 L44,40 M36,46 L31,36"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className={styles.formContent}>
          <div className={styles.formWrapper}>{children}</div>
        </div>
      </div>
    </div>
  )
}
