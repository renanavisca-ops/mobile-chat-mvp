import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Terms of Service — Toky Chat' };

const H2 = 'mb-3 text-lg font-semibold text-slate-100';
const UL = 'list-disc space-y-1 pl-5';
const mail = LEGAL.supportEmail;

function En() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-xs text-slate-500">Effective date: {LEGAL.effectiveDate} · Last updated: {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>These Terms are a binding agreement between you and {LEGAL.operator}, an independent app operated by its individual creators based in {LEGAL.country} (&quot;we&quot;, &quot;us&quot;). By using the Service you agree to these Terms and our{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>. If you do not agree, do not use the Service.</p>
        </section>
        <section>
          <h2 className={H2}>1. Eligibility &amp; age</h2>
          <p>You must be at least <b>{LEGAL.minAge}</b> years old (or the minimum age of digital consent in your country) to use the Service. If you are under the age of majority, a parent or guardian must agree to these Terms.</p>
        </section>
        <section>
          <h2 className={H2}>2. The Service</h2>
          <p>Toky Chat lets you send messages and media, make voice and video calls, and create one-to-one and group chats. We may add, change, or remove features at any time. Direct chats are end-to-end encrypted by default; group chats and channels may not be. See the Privacy Policy for details.</p>
        </section>
        <section>
          <h2 className={H2}>3. Your account</h2>
          <ul className={UL}>
            <li>Provide accurate information and keep your credentials confidential.</li>
            <li>You are responsible for activity under your account; notify us of any unauthorized use at {mail}.</li>
            <li>Do not share, sell, or transfer your account.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>4. Acceptable use</h2>
          <p>You agree not to, and not to help others: violate the law or others&apos; rights; harass, threaten, or abuse anyone; post content that is hateful, violent, or that sexually exploits or endangers minors; share non-consensual intimate imagery; send spam; distribute malware or attempt unauthorized access; impersonate others; or interfere with or overload the Service. See our{' '}
            <Link href="/guidelines" className="text-blue-400 hover:text-blue-300">Community Guidelines</Link>.</p>
        </section>
        <section>
          <h2 className={H2}>5. Your content &amp; license</h2>
          <p>You own the content you share. You grant us a worldwide, non-exclusive, royalty-free license to host, store, and transmit it solely to operate and secure the Service (for example, to deliver a message to its recipients). This license ends when your content is deleted, except for content already shared with others or retained briefly in backups. You are responsible for your content and represent that you have the rights to it.</p>
        </section>
        <section>
          <h2 className={H2}>6. Reporting, moderation &amp; enforcement</h2>
          <p>You can report content or users and block others within the Service. We may remove content and warn, suspend, or terminate accounts that violate these Terms or create legal or safety risk, and we may preserve and disclose information where required by law.</p>
        </section>
        <section>
          <h2 className={H2}>7. Third-party services &amp; IP</h2>
          <p>The Service relies on third-party providers and may link to third-party content, which is governed by their own terms. The Service, its software and trademarks are owned by {LEGAL.operator} or its licensors; you receive a limited, revocable, non-transferable license to use it for personal, non-commercial use.</p>
        </section>
        <section>
          <h2 className={H2}>8. Termination &amp; disclaimers</h2>
          <p>You may stop using the Service and delete your account at any time. We may suspend or terminate access for violations or to protect the Service. The Service is provided &quot;as is&quot; without warranties of any kind, to the maximum extent permitted by law. To the extent permitted by law, our liability is limited; nothing here excludes liability that cannot legally be excluded.</p>
        </section>
        <section>
          <h2 className={H2}>9. Governing law &amp; contact</h2>
          <p>These Terms are governed by the laws of {LEGAL.country}, and disputes will be subject to its competent courts — without removing mandatory consumer-protection rights you have under the laws of the country where you live. We may update these Terms; material changes will be notified in the Service and continued use means acceptance. Contact: <a className="text-blue-400 hover:text-blue-300" href={`mailto:${mail}`}>{mail}</a>.</p>
        </section>
      </div>
    </>
  );
}

function Es() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Términos del servicio</h1>
      <p className="mt-1 text-xs text-slate-500">Fecha de vigencia: {LEGAL.effectiveDate} · Última actualización: {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>Estos Términos son un acuerdo vinculante entre tú y {LEGAL.operator}, una app independiente operada por sus creadores, con base en {LEGAL.country} (&quot;nosotros&quot;). Al usar el Servicio aceptas estos Términos y nuestra{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Política de privacidad</Link>. Si no estás de acuerdo, no uses el Servicio.</p>
        </section>
        <section>
          <h2 className={H2}>1. Elegibilidad y edad</h2>
          <p>Debes tener al menos <b>{LEGAL.minAge}</b> años (o la edad mínima de consentimiento digital en tu país) para usar el Servicio. Si eres menor de edad, un padre, madre o tutor debe aceptar estos Términos.</p>
        </section>
        <section>
          <h2 className={H2}>2. El Servicio</h2>
          <p>Toky Chat te permite enviar mensajes y multimedia, hacer llamadas de voz y video, y crear chats individuales y de grupo. Podemos agregar, cambiar o quitar funciones en cualquier momento. Los chats directos están cifrados de extremo a extremo de forma predeterminada; los chats de grupo y canales pueden no estarlo. Consulta la Política de privacidad.</p>
        </section>
        <section>
          <h2 className={H2}>3. Tu cuenta</h2>
          <ul className={UL}>
            <li>Proporciona información veraz y mantén tus credenciales en secreto.</li>
            <li>Eres responsable de la actividad de tu cuenta; avísanos de cualquier uso no autorizado a {mail}.</li>
            <li>No compartas, vendas ni transfieras tu cuenta.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>4. Uso aceptable</h2>
          <p>Aceptas no hacer, ni ayudar a otros a: violar la ley o los derechos de terceros; acosar, amenazar o abusar de nadie; publicar contenido de odio, violento o que explote sexualmente o ponga en peligro a menores; compartir imágenes íntimas sin consentimiento; enviar spam; distribuir software malicioso o intentar accesos no autorizados; hacerte pasar por otros; o interferir con el Servicio o sobrecargarlo. Consulta nuestras{' '}
            <Link href="/guidelines" className="text-blue-400 hover:text-blue-300">Normas de la comunidad</Link>.</p>
        </section>
        <section>
          <h2 className={H2}>5. Tu contenido y licencia</h2>
          <p>Eres dueño del contenido que compartes. Nos concedes una licencia mundial, no exclusiva y gratuita para alojarlo, almacenarlo y transmitirlo únicamente para operar y proteger el Servicio (por ejemplo, para entregar un mensaje a sus destinatarios). Esta licencia termina cuando eliminas tu contenido, salvo el ya compartido con otros o retenido brevemente en respaldos. Eres responsable de tu contenido y declaras tener los derechos sobre él.</p>
        </section>
        <section>
          <h2 className={H2}>6. Denuncias, moderación y aplicación</h2>
          <p>Puedes denunciar contenido o usuarios y bloquear a otros dentro del Servicio. Podemos eliminar contenido y advertir, suspender o cerrar cuentas que incumplan estos Términos o generen riesgo legal o de seguridad, y podemos conservar y divulgar información cuando la ley lo exija.</p>
        </section>
        <section>
          <h2 className={H2}>7. Servicios de terceros y propiedad intelectual</h2>
          <p>El Servicio depende de proveedores externos y puede enlazar a contenido de terceros, regido por sus propios términos. El Servicio, su software y marcas pertenecen a {LEGAL.operator} o sus licenciantes; recibes una licencia limitada, revocable e intransferible para uso personal y no comercial.</p>
        </section>
        <section>
          <h2 className={H2}>8. Terminación y renuncias</h2>
          <p>Puedes dejar de usar el Servicio y eliminar tu cuenta cuando quieras. Podemos suspender o cancelar el acceso por incumplimientos o para proteger el Servicio. El Servicio se ofrece &quot;tal cual&quot;, sin garantías de ningún tipo, en la máxima medida permitida por la ley. En la medida permitida por la ley, nuestra responsabilidad es limitada; nada de esto excluye responsabilidades que legalmente no puedan excluirse.</p>
        </section>
        <section>
          <h2 className={H2}>9. Ley aplicable y contacto</h2>
          <p>Estos Términos se rigen por las leyes de {LEGAL.country}, y las disputas se someterán a sus tribunales competentes — sin eliminar los derechos obligatorios de protección al consumidor que tengas según las leyes del país donde vives. Podemos actualizar estos Términos; los cambios importantes se notificarán en el Servicio y el uso continuado implica aceptación. Contacto: <a className="text-blue-400 hover:text-blue-300" href={`mailto:${mail}`}>{mail}</a>.</p>
        </section>
      </div>
    </>
  );
}

export default function TermsPage() {
  return <LegalDoc en={<En />} es={<Es />} />;
}
