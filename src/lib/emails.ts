/**
 * Transactional email templates. Plain and on-brand: warm off-white body, one
 * white card, the teal accent only on the single button. Each returns subject,
 * html, and text for sendEmail. More templates land here as later phases wire
 * up the notification events.
 */

interface Email {
  subject: string;
  html: string;
  text: string;
}

/** Escape user-supplied text before it goes into email HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One white card with a heading, a line of context, and a single button. */
function layout(
  heading: string,
  context: string,
  buttonLabel: string,
  buttonUrl: string,
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#faf9f7;padding:32px 16px;font-family:ui-sans-serif,system-ui,sans-serif;color:#131110;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;">My Tasks</p>
                <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">${heading}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#57534e;">${context}</p>
                <a href="${buttonUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 20px;border-radius:10px;">${buttonLabel}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function signInEmail(url: string): Email {
  return {
    subject: "Your My Tasks sign-in link",
    html: layout(
      "Sign in to My Tasks",
      "Use the button below to sign in. It works once and expires in 15 minutes. If you did not request it, you can ignore this email.",
      "Sign in",
      url,
    ),
    text: `Sign in to My Tasks:\n${url}\n\nThis link works once and expires in 15 minutes. If you did not request it, you can ignore this email.`,
  };
}

export function inviteEmail(url: string): Email {
  return {
    subject: "You have been invited to My Tasks",
    html: layout(
      "You have access to My Tasks",
      "You can now send tasks and follow their progress. Use the button below to sign in. The link works once and expires in 15 minutes; afterward you can set a password from Settings.",
      "Get started",
      url,
    ),
    text: `You have been invited to My Tasks.\n\nSign in here (works once, expires in 15 minutes):\n${url}\n\nAfterward you can set a password from Settings.`,
  };
}

export function taskSubmittedEmail(
  url: string,
  submitterName: string,
  taskTitle: string,
): Email {
  return {
    subject: `New task from ${submitterName}`,
    html: layout(
      `New task from ${esc(submitterName)}`,
      `${esc(submitterName)} sent you a task: “${esc(taskTitle)}”. Review it when you have a moment.`,
      "Open task",
      url,
    ),
    text: `${submitterName} sent you a task: "${taskTitle}".\n\nReview it: ${url}`,
  };
}

export function taskAcceptedEmail(url: string, taskTitle: string): Email {
  return {
    subject: "Your task was accepted",
    html: layout(
      "Your task was accepted",
      `“${esc(taskTitle)}” was accepted and is being worked on. You can follow its progress here.`,
      "View task",
      url,
    ),
    text: `"${taskTitle}" was accepted and is being worked on.\n\nFollow it: ${url}`,
  };
}

export function taskDeclinedEmail(
  url: string,
  taskTitle: string,
  reason: string | null,
): Email {
  const reasonLine = reason ? ` Reason: ${reason}` : "";
  return {
    subject: "Your task was declined",
    html: layout(
      "Your task was declined",
      `“${esc(taskTitle)}” was declined.${reason ? ` Reason: ${esc(reason)}` : ""}`,
      "View task",
      url,
    ),
    text: `"${taskTitle}" was declined.${reasonLine}\n\n${url}`,
  };
}

export function newCommentEmail(
  url: string,
  commenterName: string,
  taskTitle: string,
): Email {
  return {
    subject: `New comment on “${taskTitle}”`,
    html: layout(
      "New comment",
      `${esc(commenterName)} commented on “${esc(taskTitle)}”.`,
      "Read and reply",
      url,
    ),
    text: `${commenterName} commented on "${taskTitle}".\n\nRead and reply: ${url}`,
  };
}

export function summaryReadyEmail(url: string, taskTitle: string): Email {
  return {
    subject: "Your summary is ready",
    html: layout(
      "Your summary is ready",
      `The summary for “${esc(taskTitle)}” is ready to read.`,
      "View summary",
      url,
    ),
    text: `The summary for "${taskTitle}" is ready.\n\nView it: ${url}`,
  };
}
