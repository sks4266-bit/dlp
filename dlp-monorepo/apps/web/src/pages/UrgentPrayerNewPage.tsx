import { useNavigate } from 'react-router-dom';
import UrgentPrayerComposer from '../components/urgent/UrgentPrayerComposer';
import TopBar from '../components/layout/TopBar';

export default function UrgentPrayerNewPage() {
  const nav = useNavigate();

  return (
    <div>
      <TopBar title="긴급기도 작성" backTo="/urgent-prayers" />
      <div style={{ height: 12 }} />
      <UrgentPrayerComposer onDone={(id) => nav(`/urgent-prayers?highlight=${encodeURIComponent(id)}`)} />
    </div>
  );
}
