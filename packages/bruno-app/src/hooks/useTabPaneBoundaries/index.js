import find from 'lodash/find';
import { updateRequestPaneTabHeight, updateRequestPaneTabWidth } from 'providers/ReduxStore/slices/tabs';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

const MIN_TOP_PANE_HEIGHT = 150;

export function useTabPaneBoundaries({ activeTabUid, containerRef }) {
  const DEFAULT_PANE_WIDTH_DIVISOR = 2.2;

  const tabs = useSelector((state) => state.tabs.tabs);
  const focusedTab = find(tabs, (t) => t.uid === activeTabUid);
  const preferences = useSelector((state) => state.app.preferences);
  const isVerticalLayout = preferences?.layout?.responsePaneOrientation === 'vertical';
  const screenWidth = useSelector((state) => state.app.screenWidth);
  const asideWidth = useSelector((state) => state.app.leftSidebarWidth);

  const left = focusedTab && focusedTab.requestPaneWidth ? focusedTab.requestPaneWidth : (screenWidth - asideWidth) / DEFAULT_PANE_WIDTH_DIVISOR;
  const top = focusedTab?.requestPaneHeight;

  const dispatch = useDispatch();

  useEffect(() => {
    if (!containerRef?.current || !activeTabUid) {
      return;
    }

    if (isVerticalLayout) {
      const containerRefRect = containerRef?.current?.getBoundingClientRect();

      // In vertical mode, set topPaneHeight to roughly half of the container height
      const initialHeight = containerRefRect.height / 2;
      if (focusedTab.requestPaneHeight !== initialHeight) {
        dispatch(updateRequestPaneTabHeight({
          uid: activeTabUid,
          requestPaneHeight: initialHeight
        }));
      }

      // In vertical mode, set leftPaneWidth to full container width
      if (focusedTab.requestPaneWidth !== containerRefRect.width) {
        dispatch(updateRequestPaneTabWidth({
          uid: activeTabUid,
          requestPaneWidth: containerRefRect.width
        }));
      }
    } else {
      // In horizontal mode, set to roughly half width
      let updatedRequestPaneWidth = (screenWidth - asideWidth) / DEFAULT_PANE_WIDTH_DIVISOR;
      if (focusedTab.requestPaneWidth !== updatedRequestPaneWidth) {
        dispatch(updateRequestPaneTabWidth({
          uid: activeTabUid,
          requestPaneWidth: updatedRequestPaneWidth
        }));
      }
    }
  }, [isVerticalLayout, activeTabUid, containerRef, screenWidth, asideWidth, dispatch]);

  return {
    left,
    top,
    setLeft(value) {
      dispatch(updateRequestPaneTabWidth({
        uid: activeTabUid,
        requestPaneWidth: value
      }));
    },
    setTop(value) {
      dispatch(updateRequestPaneTabHeight({
        uid: activeTabUid,
        requestPaneHeight: value
      }));
    },
    reset() {
      dispatch(updateRequestPaneTabHeight({
        uid: activeTabUid,
        requestPaneHeight: MIN_TOP_PANE_HEIGHT
      }));
      dispatch(updateRequestPaneTabWidth({
        uid: activeTabUid,
        requestPaneWidth: (screenWidth - asideWidth) / DEFAULT_PANE_WIDTH_DIVISOR
      }));
    }
  };
}
