import type { ComponentMeta } from "@/lib/meta";
import { IdentityCard } from "@/organisms/identity-card/IdentityCard";

export const identityCardMeta: ComponentMeta = {
  name: "IdentityCard",
  component: IdentityCard,
  layer: "organism",
  description: "What a thing is and what version of it is running, with one action.",
  rule: "Identity on the left, the one thing you can do about it on the right.",
  variants: [
    {
      name: "app",
      props: { name: "Apex", sub: "Desktop", meta: "v0.5.0 · Tauri 2", note: "You are up to date" },
    },
    { name: "bare", props: { name: "apexd", meta: "0.5.0" } },
  ],
};
