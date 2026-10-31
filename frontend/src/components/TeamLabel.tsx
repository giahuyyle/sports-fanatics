import * as Logos from 'mf-react-basketball-logos';
import type { Team } from '../game';

type TeamCode = Exclude<keyof typeof Logos, 'NBA'>;

export default function TeamLabel({ team }: { team: Team }) {
  const Logo = Logos[team.abbreviation as TeamCode];
  return (
    <div className="grid-label team-label" title={team.name}>
      {Logo && <Logo size={44} aria-hidden="true" focusable="false" />}
      <span>{team.abbreviation}</span>
    </div>
  );
}
