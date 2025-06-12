import React, { useEffect, useState, useRef } from "react";
import { VISUALIZERS } from "../../constants";
import * as Selectors from "../../selectors";
import { TransitionType } from "../../types";
import { useTypedSelector } from "../../hooks";

type ButterchurnVisualizer = {
  setRendererSize(width: number, height: number): void;
  loadPreset(preset: Object, transitionTime: number): void;
  launchSongTitleAnim(title: string): void;
  render(): void;
};

type Props = {
  analyser: AnalyserNode;
  height: number;
  width: number;
};

const TRANSITION_TYPE_DURATIONS = {
  [TransitionType.DEFAULT]: 2.7,
  [TransitionType.IMMEDIATE]: 0,
  [TransitionType.USER_PRESET]: 5.7,
};

function Visualizer({ analyser, width, height }: Props) {
  const visualizerStyle = useTypedSelector(Selectors.getVisualizerStyle);
  const playing = useTypedSelector(Selectors.getMediaIsPlaying);
  const butterchurn = useTypedSelector(Selectors.getButterchurn);
  const trackTitle = useTypedSelector(Selectors.getCurrentTrackDisplayName);
  const currentTrackId = useTypedSelector(Selectors.getCurrentTrackId);
  const currentPreset = useTypedSelector(Selectors.getCurrentPreset);
  const transitionType = useTypedSelector(Selectors.getPresetTransitionType);
  const message = useTypedSelector(Selectors.getMilkdropMessage);

  const isEnabledVisualizer = visualizerStyle === VISUALIZERS.MILKDROP;

  const canvasRef = useRef(null);
  const [visualizer, setVisualizer] = useState<ButterchurnVisualizer | null>(
    null
  );
  const lastLoggedTrackId = useRef<number | null>(null);
  const lastLoggedTitleTrackId = useRef<number | null>(null);

  useEffect(() => {
    // We only log when we're playing and the track has changed.
    if (playing && currentTrackId !== lastLoggedTrackId.current) {
      const logData = {
        title: trackTitle,
        trackId: String(currentTrackId),
        event: "track_change",
      };

      fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logData),
      }).catch((err) =>
        console.error(
          `[${new Date().toISOString()}] Failed to log track change:`,
          err
        )
      );

      // Remember the track we just logged.
      lastLoggedTrackId.current = currentTrackId;
    }
  }, [playing, currentTrackId, trackTitle]);

  useEffect(() => {
    const logTitle = () => {
      // Don't log if we're not playing or there's no title.
      if (
        !playing ||
        !trackTitle ||
        lastLoggedTitleTrackId.current === currentTrackId
      ) {
        return;
      }
      lastLoggedTitleTrackId.current = currentTrackId;

      const logData = {
        event: "milkdrop_track_title_displayed",
      };

      fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logData),
      }).catch((err) =>
        console.error(
          `[${new Date().toISOString()}] Failed to log milkdrop title display:`,
          err
        )
      );
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        logTitle();
      }
    };

    // Log the title when the track changes and the window is visible.
    if (!document.hidden) {
      logTitle();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [playing, trackTitle, currentTrackId]);

  // When track changes, reset the title log ref, so we can log it again if it becomes visible.
  useEffect(() => {
    lastLoggedTitleTrackId.current = null;
  }, [currentTrackId]);

  // Initialize the visualizer
  useEffect(() => {
    if (canvasRef.current == null || butterchurn == null) {
      return;
    }
    if (visualizer != null) {
      // Note: The visualizer does not offer anyway to clean itself up. So, we
      // don't offer any way to recreate it. So, if you swap out the analyser
      // node, or the canvas, that change won't be respected.
      return;
    }
    const _visualizer = butterchurn.createVisualizer(
      analyser.context,
      canvasRef.current,
      {
        width,
        height,
        meshWidth: 32,
        meshHeight: 24,
        pixelRatio: window.devicePixelRatio || 1,
      }
    );
    _visualizer.connectAudio(analyser);
    setVisualizer(_visualizer);
  }, [butterchurn, analyser, height, width, visualizer]);

  // Ensure render size stays up to date
  useEffect(() => {
    if (visualizer == null) {
      return;
    }
    visualizer.setRendererSize(width, height);
  }, [visualizer, width, height]);

  // Load presets when they change
  const hasLoadedPreset = useRef<boolean>(false);
  useEffect(() => {
    if (visualizer == null || currentPreset == null) {
      return;
    }
    if (hasLoadedPreset.current) {
      visualizer.loadPreset(
        currentPreset,
        TRANSITION_TYPE_DURATIONS[transitionType]
      );
    } else {
      visualizer.loadPreset(
        currentPreset,
        TRANSITION_TYPE_DURATIONS[TransitionType.IMMEDIATE]
      );
      hasLoadedPreset.current = true;
    }
    // We don't want to trigger the transition if the transition type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualizer, currentPreset]);

  // Handle title animations
  useEffect(() => {
    if (visualizer == null || !trackTitle) {
      return;
    }
    visualizer.launchSongTitleAnim(trackTitle);
  }, [visualizer, trackTitle]);

  const lastShownMessage = useRef<null | number>(null);

  useEffect(() => {
    if (visualizer == null || message == null) {
      return;
    }
    if (
      lastShownMessage.current == null ||
      message.time > lastShownMessage.current
    ) {
      lastShownMessage.current = Date.now();
      visualizer.launchSongTitleAnim(message.text);
    }
  }, [visualizer, message]);

  const shouldAnimate = playing && isEnabledVisualizer;

  // Kick off the animation loop
  useEffect(() => {
    if (!shouldAnimate || visualizer == null) {
      return;
    }
    let animationFrameRequest: number | null = null;
    const loop = () => {
      visualizer.render();
      animationFrameRequest = window.requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (animationFrameRequest != null) {
        window.cancelAnimationFrame(animationFrameRequest);
      }
    };
  }, [visualizer, shouldAnimate]);

  return (
    <canvas
      height={height}
      width={width}
      style={{
        height: "100%",
        width: "100%",
        display: isEnabledVisualizer ? "block" : "none",
      }}
      ref={canvasRef}
    />
  );
}

export default Visualizer;
