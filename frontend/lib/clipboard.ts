/**
 * Copy text to the clipboard.
 *
 * Uses the async Clipboard API when available in a secure context; otherwise
 * falls back to a temporary textarea + execCommand("copy") so copying still
 * works in older browsers or non-secure contexts.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.select();

  let succeeded = false;

  try {
    succeeded = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  if (!succeeded) {
    throw new Error("Clipboard copy failed.");
  }
}
