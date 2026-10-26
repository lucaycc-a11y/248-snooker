// WhatsApp support link for payment screens. Every "something went wrong with my
// payment" page links here with a prefilled message that carries the references
// support needs to find the booking's payment_events timeline.
export function whatsappDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.length === 8 ? `852${digits}` : digits
}

export function whatsappSupportUrl(phone: string, message: string): string {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(message)}`
}

export function buildSupportMessage(
  template: string,
  values: { code: string; order: string; state: string },
): string {
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return template
    .replace("{code}", values.code)
    .replace("{order}", values.order)
    .replace("{state}", values.state)
    .replace("{time}", time)
}
