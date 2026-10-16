// Every screen's frame: the drifting backdrop, the demo-mode and storage banners, and the
// catch-up work the phone app does at its root: settle closed windows once storage is read and
// whenever the tab comes back, and pick up changes made in another tab.
import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { startLifecycle } from '@/store/lifecycle';

import { ROUTES } from '../nav';
import { pageVisibility } from '../platform/lifecycle';
import { leaveDemo } from '../platform/mode';
import { onOtherTabChange } from '../platform/storage';
import { appStore, demoMode, storagePersistent, storeKey, useApp } from '../store';
import { ZeroField } from '../ui/ZeroField';

export function Layout() {
  const hydrated = useApp((s) => s.hydrated);
  const { pathname } = useLocation();

  useEffect(() => startLifecycle(appStore, pageVisibility), []);
  useEffect(() => onOtherTabChange(storeKey, () => void appStore.persist.rehydrate()), []);

  return (
    <>
      <ZeroField hidden={pathname === ROUTES.round} />
      <div className="app-root">
        {demoMode ? (
          <div className="banner demo-banner" role="note">
            <span>
              <strong>Demo mode.</strong> You&apos;re trying the demo controls on a copy of your progress. Your real streak
              isn&apos;t touched.
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                leaveDemo();
                window.location.assign('/play');
              }}
            >
              Leave demo mode
            </button>
          </div>
        ) : null}
        {!storagePersistent ? (
          <div className="banner" role="note">
            This browser isn&apos;t keeping your progress (a private window, or site data is turned off), so it will be
            gone when you close this tab.
          </div>
        ) : null}
        {hydrated ? <Outlet /> : null}
      </div>
      <ScrollRestoration />
    </>
  );
}
