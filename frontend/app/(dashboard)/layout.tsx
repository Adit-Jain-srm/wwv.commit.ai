import { SearchProvider } from "../../lib/SearchContext";
import { DashboardDataProvider } from "../../lib/DashboardDataContext";
import { DemoModeProvider } from "../../lib/DemoModeContext";
import { DashboardLayout } from "../../components/layout/DashboardLayout";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SearchProvider>
      <DashboardDataProvider>
        <DemoModeProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </DemoModeProvider>
      </DashboardDataProvider>
    </SearchProvider>
  );
}
