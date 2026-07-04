import { SettingsTabs } from "@/components/settings-tabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsTabs className="mt-4" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
