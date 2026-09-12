import {
  getTwilioConfig,
  getTwilioWhatsAppPublicStatus,
  twilioBasicAuth,
} from "@/lib/twilio/config";

export type TwilioHealthPublicStatus = {
  configured: boolean;
  connected: boolean;
  from: string | null;
};

/**
 * Lightweight authenticated Twilio API check.
 * Does not send WhatsApp messages and never returns secrets.
 */
export async function checkTwilioApiHealth(): Promise<TwilioHealthPublicStatus> {
  const publicStatus = getTwilioWhatsAppPublicStatus();
  const config = getTwilioConfig();

  if (!config || !publicStatus.configured) {
    return { configured: false, connected: false, from: null };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        config.accountSid,
      )}.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${twilioBasicAuth(config)}`,
        },
        cache: "no-store",
      },
    );
    await response.text().catch(() => "");

    return {
      configured: true,
      connected: response.ok,
      from: publicStatus.from,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      from: publicStatus.from,
    };
  }
}
