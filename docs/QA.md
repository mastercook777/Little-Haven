# 守望谷 v0.2 QA & release record

## Automated tests

Simulation tests in `tests/simulation.test.mts` verify initial state, visitor timing, two distinct branches, passive automatic default, deterministic threshold order under large vs small deltas, character stage visibility, persistence and old save namespace preservation, and bad-input fallback.

Commands:

```bash
npm run test:sim
npm run check
npm run build:pages
```

The first command needs Node 22 and no installed dependencies. The other two need npm to install Vite, TypeScript and Three.js.

## Browser acceptance scenarios

1. Fresh launch: scene shows gray tiled tavern and wine sign, bridge, bamboo, exercise ground and residents, no blank canvas.
2. 1× / 4× / 12× / 流年 speed and pause work; changing viewpoint does not break resident picking.
3. After the visitor event, both guardian choices can be clicked. UI updates from the world state.
4. Host ending visibly adds the sword study; Observe ending adds a tea pavilion on the east bank.
5. A-Qing is absent in `departed`/`rumor` and visible again in `returned`/`legacy`.
6. Reload preserves story and chapter, and `little-haven-prototype-v01` remains untouched.
7. Test desktop 1440×900 and touch viewport 390×844, including long Chinese strings.

## Residual limitations

- A story arc can be observed in fast forward, but the game is not yet a repeatable, infinite wuxia narrative engine.
- Residents walk between routine destinations by linear paths; no complete navmesh, collision system or crowds.
- No real combat, intergenerational systems, cross-device save or AI-generation cost.
- Roadside traveler uses a simple waypath and the bridge; movement between all ordinary home/job points is not guaranteed to avoid every obstruction.
- Very long inactive sessions cap each offline catch-up to 120 real seconds equivalent; there is no silent destructive event.
