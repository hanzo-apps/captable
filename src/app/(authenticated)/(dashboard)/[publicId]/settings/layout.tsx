import { PageLayout } from "@/components/dashboard/page-layout";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { Card } from "@/components/ui/card";

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <PageLayout title="Settings">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3">
          <SettingsSidebar />
        </div>
        <div className="col-span-12 md:col-span-9">
          <Card className="p-5">{children}</Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsLayout;
