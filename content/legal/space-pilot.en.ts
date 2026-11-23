// Space Pilot data collection and AI training notice (en). Draft — to be reviewed by legal counsel before release.
import type { LegalDocument } from './types'

export const spacePilotEn: LegalDocument = {
  title: "Space Pilot Data and AI Training Notice",
  intro: "Space Pilot is the scoring and highlight system used at SPACE8. This notice explains what data we collect when you use it, why, how long we keep it, and how some data is used to improve our artificial intelligence (AI) features. It supplements, and does not replace, our Privacy Policy.",
  sections: [
    {
      title: "Data we collect",
      body: "When you use Space Pilot we may collect:\n- Match data: participating members, scores, results, match history and progress statistics;\n- Photos: photos taken on the in-venue iPad that you choose to save;\n- Highlight clips: short clips recorded by a phone or in-venue camera during a match (which may include your image and voice);\n- Technical data: device identifiers, room and timestamps.\n\nCameras record only while a match is in progress. We do not record in restrooms or any other private area.",
    },
    {
      title: "How we use data",
      body: "We use this data to:\n1. provide scoring, match history, progress charts, yearly recaps and result posters;\n2. automatically cut and generate highlight clips that you can save or share through a QR code;\n3. keep the system secure and resolve disputes;\n4. subject to the rules below, train and improve our AI features.\n\nWe do not sell your data to third parties and do not use it for advertising.",
    },
    {
      title: "AI analysis and third-party processing",
      body: "To generate clip titles and verify highlights, some clips or match data are sent to the AI service provider we use (currently Xiaomi MiMo) for analysis. The provider processes data only on our instructions. AI results may be inaccurate, are provided for reference only, and do not affect how a match result is determined.",
    },
    {
      title: "Data used for AI training",
      body: "Some highlight clips may be marked as \"training data\" and used to train and improve AI features such as pot detection.\n- Training data is limited to match-camera clips and never includes your personal photo album;\n- we try not to keep directly identifying information, and we do not label training clips with member names or contact details;\n- you may at any time ask us, as set out in section 8, not to use your image for AI training and to delete the related clips.\n\nIf you do not wish to be in camera view, please tell our staff before your match.",
    },
    {
      title: "Retention",
      body: "- Individual photos: kept for 30 days from capture, then deleted automatically; you may also delete them yourself at any time;\n- Highlight clips you have not saved: deleted automatically after 24 hours;\n- Highlight clips you have saved: deleted automatically after 30 days;\n- Training data: kept for at most 180 days and deleted at expiry or once training is complete, whichever is earlier;\n- Match records and statistics: kept while your member account exists and removed when it is deleted.\n\nThis does not apply where the law requires us to retain data.",
    },
    {
      title: "Encryption and access control",
      body: "We protect data as follows:\n- all photos and clips are stored in non-public storage, protected by encrypted connections in transit and encrypted at rest;\n- training data is stored separately from ordinary data and can be accessed only by authorised SPACE8 administrators;\n- access is logged;\n- share links are generated only when you choose to share, and expire.\n\nNo system can guarantee absolute security. If a data breach occurs, we will notify affected individuals as required by law.",
    },
    {
      title: "Your choices and rights",
      body: "You have the right to:\n- access and correct the personal data we hold about you;\n- ask us to delete your photos, clips and match records;\n- object to your image being used for AI training, or withdraw consent previously given;\n- opt out of recording without losing basic scoring.\n\nWithdrawing consent does not affect processing carried out before withdrawal.",
    },
    {
      title: "Consent and persons under 18",
      body: "By scanning your member code and starting a match you confirm that you have read and agree to this notice. Persons under 18 must have a parent or guardian's consent to use recording. We do not knowingly use images of minors for AI training.",
    },
    {
      title: "Changes and contact",
      body: "We may update this notice; the revised version will be posted on this page with its update date. For questions or to exercise the rights above, contact SPACE8 via the official WhatsApp (6180 8022) or email (Info@space8.com.hk).",
    },
  ],
}
