import type { Metadata } from "next";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata: Metadata = {
  title: "反馈",
  description: "提交 Draftly 的使用意见、功能建议和问题反馈。",
};

export default function FeedbackPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="FEEDBACK / 08"
        icon="message"
        title="把不顺手的地方，留在文件袋里"
        subtitle="反馈会进入真实的后台，用来判断下一轮先改哪个工具。请尽量写清楚你当时想做什么、卡在哪一步。"
        badge={<span className="chip">真实提交</span>}
      />
      <FeedbackForm />
    </div>
  );
}