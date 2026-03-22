import { useLocation, useNavigate } from 'react-router-dom';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';

export default function UrgentPrayerNewPage() {
  const nav = useNavigate();
  const location = useLocation();

  function goLogin() {
    const next = `${location.pathname}${location.search}`;
    nav(`/login?${new URLSearchParams({ next }).toString()}`);
  }

  return (
    <div>
      <TopBar title="긴급기도 작성" backTo="/urgent-prayers" />
      <div style={{ height: 12 }} />
      <UrgentPrayerComposer
        onUnauthorized={goLogin}
        onDone={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)}
      />
    </div>
  );
}
