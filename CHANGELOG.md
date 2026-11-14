# Changelog

## [2026.11.14](https://github.com/echohello-dev/pidex/compare/2026.11.04-2...2026.11.14) (2026-11-14)


### Features

* add copy and truncation controls to tool call cards ([#38](https://github.com/echohello-dev/pidex/issues/38)) ([9c0a66b](https://github.com/echohello-dev/pidex/commit/9c0a66bc304bd35559c5ac5e5ec742397df666ab))
* add recovery summary to session history export ([#46](https://github.com/echohello-dev/pidex/issues/46)) ([f122358](https://github.com/echohello-dev/pidex/commit/f1223589602c58d0ec82f887045735ba8a0d61ab))
* add resume handoff guidance to session export ([#44](https://github.com/echohello-dev/pidex/issues/44)) ([b92ab4b](https://github.com/echohello-dev/pidex/commit/b92ab4bd0dd3d0284b8815673a386e90c14041e3))
* add session-tree navigation and branch-aware continuation ([#33](https://github.com/echohello-dev/pidex/issues/33)) ([67b8022](https://github.com/echohello-dev/pidex/commit/67b80227e7db0eb67dd9b007b2b74b93ac663637))
* copy selected history context for workspace handoff ([#52](https://github.com/echohello-dev/pidex/issues/52)) ([3c46aa1](https://github.com/echohello-dev/pidex/commit/3c46aa1dab730fe840a18a2721228687de970b8c))
* group workspace roots and switch safely ([#34](https://github.com/echohello-dev/pidex/issues/34)) ([46b15b3](https://github.com/echohello-dev/pidex/commit/46b15b3ba6b0672bcb49cb3509d1ae9aa2de1ce8))
* include tool context in session history export ([#42](https://github.com/echohello-dev/pidex/issues/42)) ([3384421](https://github.com/echohello-dev/pidex/commit/3384421cccacc2c0d04401d7efbdd7ec57b7ff7f))
* inspect the end of long tool output ([#67](https://github.com/echohello-dev/pidex/issues/67)) ([072f7a2](https://github.com/echohello-dev/pidex/commit/072f7a29e19296c7ac61d527102151adb3e7a8bd))
* inspect tool input and output independently ([#54](https://github.com/echohello-dev/pidex/issues/54)) ([9d3ab24](https://github.com/echohello-dev/pidex/commit/9d3ab2464d75e5d7cfcdae706d0488911af759c5))
* prepare history context in another workspace root ([#56](https://github.com/echohello-dev/pidex/issues/56)) ([a60c439](https://github.com/echohello-dev/pidex/commit/a60c43953281e848487902aa01de032e1602f86d))
* preserve history selection in portable context ([#77](https://github.com/echohello-dev/pidex/issues/77)) ([68db2f4](https://github.com/echohello-dev/pidex/commit/68db2f4a8ca559e54ffffc61974e21714c5715c5))
* preview images in tool output cards ([#75](https://github.com/echohello-dev/pidex/issues/75)) ([f2ae5ff](https://github.com/echohello-dev/pidex/commit/f2ae5ffa3a536d188a1c8c1c30a27cad674a35f0))
* render edit and write tool input as a line diff ([#40](https://github.com/echohello-dev/pidex/issues/40)) ([1a1c91e](https://github.com/echohello-dev/pidex/commit/1a1c91e79c84952d2520565dd8370609c5ee1afb))
* show current Git status before resuming history ([#65](https://github.com/echohello-dev/pidex/issues/65)) ([1c688db](https://github.com/echohello-dev/pidex/commit/1c688dba4f9b2e39f8f321ad8bb80bb5eb8bb089))
* show full tool input on tool call cards ([#36](https://github.com/echohello-dev/pidex/issues/36)) ([e430b81](https://github.com/echohello-dev/pidex/commit/e430b81e8b539f4a8f55f2bb4302a4eae1105744))
* show local upstream comparison in workspace status ([#71](https://github.com/echohello-dev/pidex/issues/71)) ([02297cd](https://github.com/echohello-dev/pidex/commit/02297cd0e1fe31a67f7803378b83bd9dcc22013d))
* show recovery summary for selected history branch ([#50](https://github.com/echohello-dev/pidex/issues/50)) ([4cc4d2d](https://github.com/echohello-dev/pidex/commit/4cc4d2d70ae0d153a1c2038e5294396647ac6021))
* show repository HEAD before starting or resuming Pi ([#69](https://github.com/echohello-dev/pidex/issues/69)) ([c37ccdd](https://github.com/echohello-dev/pidex/commit/c37ccdd7e9e123bcf74cca396d1c817ef7ff4483))
* show workspace Git status before starting a session ([#58](https://github.com/echohello-dev/pidex/issues/58)) ([f4fd7a6](https://github.com/echohello-dev/pidex/commit/f4fd7a66f3a92d8ee261db6207a4af5737ce9c6c))


### Bug Fixes

* bound long-line tool diff previews ([#60](https://github.com/echohello-dev/pidex/issues/60)) ([a25471a](https://github.com/echohello-dev/pidex/commit/a25471a64cce8ff269bf88023af274c3d057297c))
* distinguish interrupted tool calls from completion ([#48](https://github.com/echohello-dev/pidex/issues/48)) ([4b133ff](https://github.com/echohello-dev/pidex/commit/4b133ff3d58215037d33d943a73fb8d4e7e467a6))
* report tool-card clipboard failures and stale copy feedback ([#73](https://github.com/echohello-dev/pidex/issues/73)) ([6da2714](https://github.com/echohello-dev/pidex/commit/6da271481641cc73d9fd497d1b124aa1bb179f76))
* validate release checks after version updates ([#32](https://github.com/echohello-dev/pidex/issues/32)) ([a7e9f44](https://github.com/echohello-dev/pidex/commit/a7e9f443ff8bc813c6c4a19a8d61be3c87287519))


### CI

* manage CalVer releases with Release Please ([#30](https://github.com/echohello-dev/pidex/issues/30)) ([991f15d](https://github.com/echohello-dev/pidex/commit/991f15dd4752926e55ff3f714bd73aa2854e53e6))


### Tests

* verify history footer painting at native window sizes ([#63](https://github.com/echohello-dev/pidex/issues/63)) ([41d05c8](https://github.com/echohello-dev/pidex/commit/41d05c87923c87586d439dc716151eba6aa8c46d))
