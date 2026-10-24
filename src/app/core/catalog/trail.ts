import type { Project, Protocol, Theme } from './catalog.model';

export interface Crumb {
  readonly label: string;
  readonly link: readonly string[];
}

/** The breadcrumb ancestors for whatever part of a lineage is known, top-down. */
export function trailOf(lineage: {
  readonly project?: Project;
  readonly protocol?: Protocol;
  readonly theme?: Theme;
}): Crumb[] {
  const { project, protocol, theme } = lineage;
  return [
    ...(project ? [{ label: project.name, link: ['/projects', project.id] }] : []),
    ...(protocol ? [{ label: protocol.name, link: ['/protocols', protocol.id] }] : []),
    ...(theme ? [{ label: theme.name, link: ['/themes', theme.id] }] : []),
  ];
}
