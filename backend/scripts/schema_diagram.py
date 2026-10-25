"""Print a physical Mermaid schema snapshot from the model metadata."""

import app.db.catalog  # noqa: F401
import app.db.identity  # noqa: F401
from app.db.base import Base


def diagram():
    lines = ["```mermaid", "erDiagram"]
    for table in Base.metadata.sorted_tables:
        lines.append(f"    {table.name} {{")
        unique_cols = {
            tuple(c.columns)[0].name
            for c in table.constraints
            if c.__class__.__name__ == "UniqueConstraint" and len(c.columns) == 1
        }
        for column in table.columns:
            flags = []
            if column.primary_key:
                flags.append("PK")
            if column.foreign_keys:
                flags.append("FK")
            if column.name in unique_cols:
                flags.append("UK")
            kind = str(column.type).replace(" ", "_").replace("(", "_").replace(")", "")
            suffix = " " + ",".join(flags) if flags else ""
            lines.append(f"        {kind} {column.name}{suffix}")
        lines.append("    }")
        for fk in table.foreign_key_constraints:
            parent = next(iter(fk.elements)).column.table.name
            col = next(iter(fk.columns)).name
            lines.append(f"    {parent} ||--o{{ {table.name} : {col}")
    lines.extend(
        ["    alembic_version {", "        VARCHAR_32 version_num PK", "    }", "```"]
    )
    return "\n".join(lines)


if __name__ == "__main__":
    print(diagram())
