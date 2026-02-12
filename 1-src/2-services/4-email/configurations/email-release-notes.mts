import { htmlHeader, htmlText, htmlBulletList, htmlActionButton, htmlFooter } from "../components/email-template-components.mjs";
import { applyTemplate, EMAIL_TEMPLATE_TYPE, EMAIL_REPLACEMENT } from "../email-template-manager.mjs";
import { sendTemplateEmail } from "../email-transporter.mjs";
import { EMAIL_SENDER_ADDRESS } from "../email-types.mjs";


/***********************************
 * WEBSITE SUBSCRIPTION to UPDATES *
 ***********************************/
export const sendSubscribeWelcomeEmail = async(email:string):Promise<boolean> => {

  const html = await applyTemplate({
    type: EMAIL_TEMPLATE_TYPE.SIMPLE,
    replacementMap: new Map([[EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'Welcome to Encouraging Prayer']]),
    bodyList: [
      htmlHeader(),

      htmlText('Welcome to the Encouraging Prayer App updates. This app is being built around shared encouragement, accountability, and prayer. As development continues, we’ll share progress and feature releases with you. You’re now connected to the early stages of what’s being created.'),

      htmlBulletList([
          'Learn by Doing: Just like learning a sport or a new language, prayer becomes second nature with guidance, practice, and accountability.',
          'Safe Space to Grow: Anonymity ensures a judgment-free zone for students to explore and strengthen their prayer life.',
          'Build a Community: While connecting with a distant partner, students will feel the power of a shared commitment to Christ.',
        ],
        'Why this matters'
      ),

      htmlText('This is just the beginning! The Encouraging Prayer App will continue to evolve with expanded resources, worship insights, and tools to deepen your connection to God.', 'The Future of Prayer'),

      htmlActionButton([{label: 'Create Account', link:`${process.env.ENVIRONMENT_BASE_URL}/signup`, style: 'PRIMARY'}]),

      htmlActionButton([{label: 'Android', link:`${process.env.ANDROID_DOWNLOAD_LINK}`, style: 'OUTLINE'},
                        {label: 'IOS', link:`${process.env.IOS_DOWNLOAD_LINK}`, style: 'OUTLINE'}], 'Download the App:'),

      htmlFooter(),
    ],
    verticalSpacing: 4,
  });

  return sendTemplateEmail('Welcome to Encouraging Prayer', html, EMAIL_SENDER_ADDRESS.SUPPORT, new Map<number, string>([[-1, email]]))
}
