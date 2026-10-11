interface GradientBackgroundProps {
  /** @deprecated Ignored. */
  grid?: boolean;
  /** @deprecated Ignored. */
  objs?: boolean;
  /** @deprecated Ignored. */
  lights?: boolean;
  /** @deprecated Ignored. */
  size?: string;
}

/**
 * Full-screen backdrop for the auth screens. It used to stack violet/pink/cyan
 * glows; now it reuses the same neutral canvas as the app (with the subtle
 * dark-mode light from `.app-canvas`).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GradientBackground = (_props: GradientBackgroundProps) => (
  <div className="app-canvas fixed inset-0 -z-10 bg-background" />
);

export default GradientBackground;
