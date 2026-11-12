"""Políticas de rama que aplican a uno o varios repos (solo lectura): las del repo y las heredadas del proyecto.
Uso: python politicas.py --org <organizacion> Proyecto/repo [Proyecto/repo ...]"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import azdo

azdo.exigir_org()

for arg in sys.argv[1:]:
    proy, repo = arg.split("/", 1)
    rid = next((r["id"] for r in azdo.repos(proy) if r["name"].lower() == repo.lower()), None)
    print(f"\n### {proy}/{repo}")
    if not rid:
        print("  repo no encontrado"); continue
    pols = azdo.get(f"{azdo.BASE}/{azdo.q(proy)}/_apis/policy/configurations?api-version=7.0").get("value", [])
    n = 0
    for p in pols:
        scopes = (p.get("settings") or {}).get("scope") or [{}]
        for s in scopes:
            if s.get("repositoryId") not in (None, rid):
                continue
            n += 1
            ref = s.get("refName") or "(todas las ramas)"
            alcance = "repo" if s.get("repositoryId") else "todo el proyecto"
            st = p.get("settings") or {}
            extra = []
            if "minimumApproverCount" in st:
                extra.append(f"mín. {st['minimumApproverCount']} aprobador(es)")
                if st.get("creatorVoteCounts") is False: extra.append("el autor no cuenta")
                if st.get("resetOnSourcePush"): extra.append("se reinicia con cada push")
            if st.get("requiredReviewerIds"): extra.append(f"{len(st['requiredReviewerIds'])} revisor(es) obligatorio(s)")
            if "allowSquash" in st or "allowNoFastForward" in st:
                extra.append("merge permitido: " + ", ".join(k.replace("allow", "") for k, v in st.items() if k.startswith("allow") and v))
            if st.get("displayName"): extra.append(st["displayName"])
            print(f"  - {p['type']['displayName']} | {ref.replace('refs/heads/', '')} | {alcance} | "
                  f"{'BLOQUEANTE' if p.get('isBlocking') else 'opcional'} | {'activa' if p.get('isEnabled') else 'DESACTIVADA'}"
                  + (f" | {'; '.join(extra)}" if extra else ""))
    if not n:
        print("  sin políticas")
