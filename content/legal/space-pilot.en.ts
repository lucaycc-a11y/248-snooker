// Space Pilot data collection notice (en). Draft — to be reviewed by legal counsel before release.
import type { LegalDocument } from './types'

export const spacePilotEn: LegalDocument = {
  title: "Space Pilot Data Collection Notice",
  intro: "Space Pilot is the scoring and highlight system used at SPACE8. This notice explains what data we collect when you use it, why, who may receive it, how long we keep it, and your rights. It supplements, and does not replace, our Privacy Policy.",
  sections: [
    {
      title: "Data we collect",
      body: "When you use Space Pilot we may collect:\n- Match data: participating members, scores, results, match history and progress statistics;\n- Photos: photos taken on the in-venue iPad that you choose to save;\n- Highlight clips: short clips recorded by a phone camera during a match (which may include your image);\n- Technical data: device identifiers, room and timestamps.\n\nMatch data is needed to use scoring; photos and clips are voluntary. If you do not agree to being recorded, tell our staff before your match; basic scoring is unaffected. Rooms where recording takes place display a notice. We do not record in restrooms or any other private area.",
    },
    {
      title: "How we use data",
      body: "We use this data only to:\n1. provide scoring, match history, progress charts, yearly recaps and result posters;\n2. automatically cut and generate highlight clips that you can save or share through a QR code;\n3. keep the system secure and resolve disputes.\n\nWe do not use your photos, clips or match data to train artificial intelligence (AI) models, we do not sell them to third parties and we do not use them for advertising.",
    },
    {
      title: "AI analysis and data transfers",
      body: "To generate clip titles and verify highlights, some clips or match data are sent to the AI service provider we use (currently Xiaomi MiMo) for analysis. We also use cloud providers (including Supabase and Vercel) to store and process data. These providers' servers may be located outside Hong Kong. AI results may be inaccurate, are for reference only, and do not affect how a match result is determined.",
    },
    {
      title: "Retention",
      body: "- Individual photos: kept for 30 days from capture, then deleted; you may also ask us to delete them at any time;\n- Highlight clips you have not saved: deleted automatically after 24 hours;\n- Highlight clips you have saved: deleted automatically after 30 days;\n- Match records and statistics: kept while your member account exists and removed when it is deleted.\n\nThis does not apply where the law requires us to retain data.",
    },
    {
      title: "Data security",
      body: "Photos and clips are stored in non-public storage, protected by encrypted connections in transit, and accessible only to authorised SPACE8 administrators. No system can guarantee absolute security; if a data breach occurs we will handle it in line with the guidance of the Hong Kong Privacy Commissioner for Personal Data and, where appropriate, notify affected individuals.",
    },
    {
      title: "Your rights",
      body: "You may ask to access and correct the personal data we hold about you, and to have your photos, clips and match records deleted. We will respond to an access request within 40 days.",
    },
    {
      title: "Consent and persons under 18",
      body: "By scanning your member code and starting a match you confirm that you have read this notice. Persons under 18 must have a parent or guardian's consent to use recording.",
    },
    {
      title: "Changes and contact",
      body: "We may update this notice; the revised version will be posted on this page with its update date. For questions or to exercise the rights above, contact SPACE8 via the official WhatsApp (6180 8022) or email (Info@space8.com.hk), marked for the attention of the \"Data Protection Officer\".",
    },
  ],
}
