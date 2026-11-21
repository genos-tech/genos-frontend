import type { Lang } from "../lpLang";

/**
 * Copy for `/contact` (MIP-1261), ja + en.
 *
 * Every line states what the form does, taken from the API it posts to
 * (`POST /api/v2/contact/`): the message is emailed to support, it is not
 * stored by Genos, and the mail provider keeps delivery logs. No response-time
 * promise, no claim the code does not make. Lines marked `TODO(copy): MIP-1261`
 * are DRAFT wording for Ken and counsel to approve before this page goes live.
 */

export type ContactTopic = "general" | "enterprise" | "security" | "press";

export interface ContactCopy {
    title: string;
    enterpriseTitle: string;
    lead: string;
    enterpriseLead: string;
    fields: {
        name: string;
        email: string;
        topic: string;
        message: string;
        messageCount: (count: number, max: number) => string;
    };
    topics: Record<ContactTopic, string>;
    submit: string;
    submitting: string;
    errors: {
        required: string;
        invalidEmail: string;
        tooLong: string;
        invalidTopic: string;
        rateLimited: string;
        unavailable: string;
        summary: string;
    };
    sent: {
        heading: string;
        body: string;
    };
    privacy: string;
    fallbackIntro: string;
}

export const CONTACT_COPY: Record<Lang, ContactCopy> = {
    en: {
        title: "Contact",
        enterpriseTitle: "Enterprise enquiry",
        lead: "Send us a message and we will reply by email. Choose the topic that fits best.",
        enterpriseLead:
            "Tell us about your team: roughly how many people would use Genos, which tools you use today, and what you would like to try first. We reply by email.",
        fields: {
            name: "Name",
            email: "Email address",
            topic: "Topic",
            message: "Message",
            messageCount: (count, max) => `${count} / ${max}`,
        },
        topics: {
            general: "General question",
            enterprise: "Enterprise enquiry",
            security: "Security report",
            press: "Press",
        },
        submit: "Send message",
        submitting: "Sending…",
        errors: {
            required: "Please fill in this field.",
            invalidEmail: "Please enter an email address we can reply to.",
            tooLong: "This is longer than the 4,000 characters allowed.",
            invalidTopic: "Please choose a topic.",
            rateLimited:
                "Too many messages have been sent from here recently. Please try again later, or email us directly.",
            unavailable:
                "Your message could not be sent right now. Please try again in a moment, or email us directly.",
            summary: "Please check the highlighted fields.",
        },
        sent: {
            heading: "Thank you, your message has been sent.",
            body: "We have received it and will reply by email.",
        },
        // TODO(copy): MIP-1261. Verified against the API: the message is mailed, not stored by
        // Genos; the mail provider (Resend) keeps delivery logs; the support inbox keeps the email.
        privacy:
            "We use your message only to reply to you. Genos does not store it, but it is sent by email to our support inbox, and our email provider keeps delivery logs. See the privacy policy.",
        fallbackIntro: "You can also email us directly at",
    },
    ja: {
        title: "お問い合わせ",
        enterpriseTitle: "Enterprise のお問い合わせ",
        lead: "メッセージをお送りください。返信はメールでいたします。最も近いお問い合わせの種類をお選びください。",
        enterpriseLead:
            "チームについて教えてください。Genos を使う人数の目安、現在お使いのツール、最初に試してみたいことなど。返信はメールでいたします。",
        fields: {
            name: "お名前",
            email: "メールアドレス",
            topic: "お問い合わせの種類",
            message: "メッセージ",
            messageCount: (count, max) => `${count} / ${max}`,
        },
        topics: {
            general: "一般的なご質問",
            enterprise: "Enterprise のお問い合わせ",
            security: "セキュリティに関するご報告",
            press: "報道関係",
        },
        submit: "送信する",
        submitting: "送信しています…",
        errors: {
            required: "この項目を入力してください。",
            invalidEmail: "返信できるメールアドレスを入力してください。",
            tooLong: "4,000 文字以内で入力してください。",
            invalidTopic: "お問い合わせの種類を選んでください。",
            rateLimited:
                "この環境から短時間に多くのメッセージが送信されました。しばらくしてから再度お試しいただくか、直接メールでお問い合わせください。",
            unavailable:
                "ただいまメッセージを送信できませんでした。しばらくしてから再度お試しいただくか、直接メールでお問い合わせください。",
            summary: "ハイライトされた項目をご確認ください。",
        },
        sent: {
            heading: "メッセージを送信しました。ありがとうございます。",
            body: "受け付けました。返信はメールでいたします。",
        },
        // TODO(copy): MIP-1261. 実装に合わせた文面。Genos はメッセージを保存せず、メール送信のみ行います。
        // メール配信サービス（Resend）は配信ログを保持し、サポート受信箱にはメールとして残ります。
        privacy:
            "いただいたメッセージは、ご返信のためだけに使います。Genos では保存しませんが、サポートの受信箱へメールで送られ、メール配信サービスが配信ログを保持します。詳しくはプライバシーポリシーをご覧ください。",
        fallbackIntro: "直接メールでお問い合わせいただくこともできます：",
    },
};
