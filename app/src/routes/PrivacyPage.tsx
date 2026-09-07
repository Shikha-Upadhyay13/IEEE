import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f7f6f3] dark:bg-gray-950 py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-8 inline-block"
        >
          ← Back to home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Effective date: September 2026
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              1. Who We Are
            </h2>
            <p>
              IEEE Paper Builder ("we", "us", "our") is a web application for creating IEEE
              conference papers. This Privacy Policy explains how we collect, use, and protect your
              personal data when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              2. Data We Collect
            </h2>
            <p>We collect the following categories of data:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Account information:</strong> Your email address and a hashed password,
                collected when you sign up. We do not store plain-text passwords.
              </li>
              <li>
                <strong>Paper content:</strong> The content of papers you create — titles, author
                names, affiliations, text, figure images, tables, equations, and references — stored
                in our database and associated with your account.
              </li>
              <li>
                <strong>Exported PDFs:</strong> PDFs you generate via the export function are stored
                in private cloud storage and accessible only to you, so you can re-download them
                from the Downloads page.
              </li>
              <li>
                <strong>AI chat history:</strong> Conversations you have with the AI assistant,
                including any paper content you attach to a chat, are stored in our database. This
                data is used solely to display your conversation history; it is not used to train AI
                models.
              </li>
              <li>
                <strong>Generated images:</strong> Prompts and image URLs from the AI image
                generation feature are stored so your gallery persists across sessions.
              </li>
              <li>
                <strong>Usage metadata:</strong> Standard server logs (IP addresses, request
                timestamps, error traces) are retained for up to 30 days for security and
                debugging purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              3. How We Use Your Data
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To authenticate you and protect your account.</li>
              <li>To save and sync your papers across devices.</li>
              <li>To generate PDF exports via a headless browser service.</li>
              <li>
                To pass paper content to the AI assistant when you explicitly request it (you
                control this by choosing which paper to attach).
              </li>
              <li>
                To send transactional emails (e.g., password reset) via Supabase's email service.
                We do not send marketing emails without your explicit opt-in.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              4. Third-Party Services
            </h2>
            <p>We use the following third-party services, each with their own privacy policies:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Supabase</strong> (supabase.com) — our database, authentication, and
                file storage provider. Your data is stored on Supabase's infrastructure.
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
                >
                  Supabase Privacy Policy →
                </a>
              </li>
              <li>
                <strong>Groq</strong> (groq.com) — powers the AI assistant. When you send a
                message, your conversation and any attached paper content are sent to Groq's API.
                Groq's data processing terms apply.
                <a
                  href="https://groq.com/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
                >
                  Groq Privacy Policy →
                </a>
              </li>
              <li>
                <strong>Pollinations.ai</strong> — powers AI image generation. Your image prompts
                are sent to Pollinations.ai's API. No API key or account is required; prompts may
                be visible to Pollinations.ai's systems.
              </li>
              <li>
                <strong>Render.com</strong> — hosts our PDF export service and AI proxy service.
              </li>
              <li>
                <strong>Vercel</strong> — hosts our frontend application.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              5. Data Retention
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account data and papers:</strong> Retained until you delete your account or
                request deletion.
              </li>
              <li>
                <strong>Exported PDFs:</strong> Retained until you delete them from the Downloads
                page, or until your account is deleted.
              </li>
              <li>
                <strong>AI chat history:</strong> Retained until you delete a conversation or your
                account.
              </li>
              <li>
                <strong>Server logs:</strong> Retained for up to 30 days, then automatically
                deleted.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              6. Your Rights (GDPR)
            </h2>
            <p>
              If you are in the European Economic Area (EEA), UK, or Switzerland, you have the
              following rights under GDPR:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <strong>Right of access:</strong> Request a copy of the personal data we hold about
                you.
              </li>
              <li>
                <strong>Right to rectification:</strong> Request correction of inaccurate data.
              </li>
              <li>
                <strong>Right to erasure ("right to be forgotten"):</strong> Request deletion of
                your account and all associated data. To exercise this right, email us at{" "}
                <a
                  href="mailto:support@ieeepaperbuilder.com"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  support@ieeepaperbuilder.com
                </a>{" "}
                and we will complete the deletion within 30 days.
              </li>
              <li>
                <strong>Right to data portability:</strong> Request your paper content exported as
                JSON. Use the editor's built-in export features; for bulk exports contact us.
              </li>
              <li>
                <strong>Right to object:</strong> Object to our processing of your data for
                legitimate interests.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              7. Cookies and Local Storage
            </h2>
            <p>
              We use browser <strong>localStorage</strong> to store your authentication session
              token (via Supabase Auth) and your theme preference. No third-party tracking cookies
              are set. We do not use advertising cookies or cross-site tracking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              8. Security
            </h2>
            <p>
              We implement industry-standard security measures including encrypted connections
              (HTTPS), hashed passwords, Row Level Security (RLS) on our database (so users can
              only access their own data), and private storage for exported PDFs. However, no
              system is completely secure; we cannot guarantee the absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              9. Children's Privacy
            </h2>
            <p>
              The Service is not directed at children under the age of 13. We do not knowingly
              collect personal data from children under 13. If you become aware that a child has
              provided us with personal data, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes via email or an in-app notice. Continued use of the Service after changes
              are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              11. Contact
            </h2>
            <p>
              For privacy-related questions or to exercise your rights, contact us at:{" "}
              <a
                href="mailto:support@ieeepaperbuilder.com"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                support@ieeepaperbuilder.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
