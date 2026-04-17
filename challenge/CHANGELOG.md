## [1.1.11](https://github.com/bitsocial/mintpass/compare/v1.1.10...v1.1.11) (2026-02-11)


### Bug Fixes

* **ci:** GitHub releases created as drafts instead of being published ([59de1dc](https://github.com/bitsocial/mintpass/commit/59de1dc616adc15dadd284a8e73434cb07b20011))



## [1.1.10](https://github.com/bitsocial/mintpass/compare/v1.1.9...v1.1.10) (2026-01-27)


### Bug Fixes

* **ci:** use Node.js 22 to match engine requirement ([278bb94](https://github.com/bitsocial/mintpass/commit/278bb94095fcd88a471fb4b6bec63ea619411f8d))



## [1.1.9](https://github.com/bitsocial/mintpass/compare/v1.1.8...v1.1.9) (2026-01-27)



## [1.1.8](https://github.com/bitsocial/mintpass/compare/v1.1.7...v1.1.8) (2026-01-21)


### Bug Fixes

* **challenge:** replace broken plebbit-js internal import with local implementation ([60d0e2e](https://github.com/bitsocial/mintpass/commit/60d0e2ea823701e544f0fe8556b69f4a93f10034))
* **ci:** extract release notes from CHANGELOG.md instead of regenerating ([792dab2](https://github.com/bitsocial/mintpass/commit/792dab23f78c74b367220e3a5adc195300e2b9e9))
* **ci:** npm publish fails with OIDC trusted publishing ([6997677](https://github.com/bitsocial/mintpass/commit/69976772da09ad31fdcd699c983cfc26896b79d9))
* npm provenance fails due to missing repository field ([7f08165](https://github.com/bitsocial/mintpass/commit/7f0816539d3a0a000830634d8dc6cf6a5a2e89ef))



## [1.1.7](https://github.com/bitsocial/mintpass/compare/v1.1.6...v1.1.7) (2026-01-21)


### Bug Fixes

* **challenge:** update to new plebbit-js challenge schema types ([f19075a](https://github.com/bitsocial/mintpass/commit/f19075a12fddc14c2f3141a3fa2da581551d8fce))
* **ci:** use OIDC ([8909e62](https://github.com/bitsocial/mintpass/commit/8909e62b30bda14b7f0dc6ff51210ab7f42b89d7))
* **web:** add operator info and update legal text in policy pages ([9be83ee](https://github.com/bitsocial/mintpass/commit/9be83ee0995f4a3d491b099d597dc50b842f99e0))
* **web:** mark more countries as unsupported ([8df05b7](https://github.com/bitsocial/mintpass/commit/8df05b74ae8150e383443f07bb5468252fc94d1f))
* **web:** pass missing prop to RequestPage ([c8e9b11](https://github.com/bitsocial/mintpass/commit/c8e9b112e5907038be52fcc39de9a6dc674b95d4))
* **web:** patch React and Next.js for CVE-2025-55182 and CVE-2025-66478 ([46f1501](https://github.com/bitsocial/mintpass/commit/46f1501255a361134ae554b11570d2d522eb7415))
* **web:** update footer contact email address ([8cb3bed](https://github.com/bitsocial/mintpass/commit/8cb3bedab821e54345b503d69f5cf35c264b0912))
* **web:** update unsupported country list ([4b92aff](https://github.com/bitsocial/mintpass/commit/4b92aff4dccf87b3794e3fc52a1ca73e86f356fe))
* **web:** updte footer layout and add company link ([9ca1472](https://github.com/bitsocial/mintpass/commit/9ca14721a611e2bc47dc73c457a4389a4bdcd133))


### Features

* **challenge:** add version check and release notes generation to CI workflows ([4e281f1](https://github.com/bitsocial/mintpass/commit/4e281f15579d0082c40b9073cfe6441ac59f052e))
* **web:** conditionally render TFV consent for US/CA on request pages ([7fa1ece](https://github.com/bitsocial/mintpass/commit/7fa1ece1b9d79fba9bedc503929c13c98657a53a))



## [1.1.6](https://github.com/bitsocial/mintpass/compare/v1.1.5...v1.1.6) (2025-10-11)


### Bug Fixes

* **challenge:** update type to "url/iframe" ([71ec935](https://github.com/bitsocial/mintpass/commit/71ec935586cc4552243622bc3cf0c79df835e990))



## [1.1.5](https://github.com/bitsocial/mintpass/compare/v1.1.1...v1.1.5) (2025-10-11)


### Bug Fixes

* **challenge:** add missing challenge field ([c2885ea](https://github.com/bitsocial/mintpass/commit/c2885ea6535d9438f6013817141a79846e83a92a))
* **challenge:** derive plebbit address via multiformats ([8614d71](https://github.com/bitsocial/mintpass/commit/8614d71276b54ebe87cd6df2883af62537cb2a73))
* **challenge:** set type to 'text/url-iframe' ([a50406c](https://github.com/bitsocial/mintpass/commit/a50406c988d5835434868e3e8ad396a45bd635d1))
* **challenge:** signature verification and eth-only wallet logic ([0d906e1](https://github.com/bitsocial/mintpass/commit/0d906e1604129a61a74baaaaac223b2ef3c91650))
* **challenge:** support dynamic chain selection in mintpass verification ([dbbe26c](https://github.com/bitsocial/mintpass/commit/dbbe26c8357f255a07a1fffd986491a209d54267))
* **challenge:** update challenge URL with query parameters ([9c82c89](https://github.com/bitsocial/mintpass/commit/9c82c89becb436fee3eeedd1e2d49e1467ca3605))
* **challenge:** use wallet address instead of author address ([c32f8cf](https://github.com/bitsocial/mintpass/commit/c32f8cfac67908ab0ac0974c9930712c13877a25))


### Features

* **challenge:** defer failure; return iframe challenge and re-check on answer ([f297ee1](https://github.com/bitsocial/mintpass/commit/f297ee1b4087f4a159c2464f8c5e0916528c1fd5))



## [1.1.1](https://github.com/bitsocial/mintpass/compare/v1.1.0...v1.1.1) (2025-09-25)


### Bug Fixes

* **challenge:** add missing try/catch around ENS path ([de01f9b](https://github.com/bitsocial/mintpass/commit/de01f9b8aa8acb3f2912e93cc6ed5c64f85e469c))
* **challenge:** ENS-first for ENS authors, mainnet ENS client, safer reads ([161ff98](https://github.com/bitsocial/mintpass/commit/161ff98a998e7c18c8f20d822e74a2d5a983c482))
* **challenge:** guard verify/reads, default base RPC to Sepolia ([f16474d](https://github.com/bitsocial/mintpass/commit/f16474d3b47df220ec25b1c3207134514b73d172))
* **challenge:** use mainnet chain for ENS and try ENS first when wallet missing ([ef3636d](https://github.com/bitsocial/mintpass/commit/ef3636df20027caf25765dd21034fbe8b35a9461))
* **challenge:** use official viem/chains configs o ENS lookups don’t throw due to missing contract metadata ([0ae5096](https://github.com/bitsocial/mintpass/commit/0ae5096602b9470517361c523edf98f5c36f9175))


### Features

* **web:** add Vercel Analytics to pages router in app ([2394f80](https://github.com/bitsocial/mintpass/commit/2394f80bbe158ba659eb085dc13f6ec341e69b0d))



# [1.1.0](https://github.com/bitsocial/mintpass/compare/94dc933767d06a1fdc981a6ecf288c25c8ac51fb...v1.1.0) (2025-09-24)


### Bug Fixes

* **api:** allow IP-only cooldown clear in admin clear-user ([04d9e38](https://github.com/bitsocial/mintpass/commit/04d9e38a0e7eba20d3c980822c48e81207d340a5))
* **challenge:** fix property path ([3552dc1](https://github.com/bitsocial/mintpass/commit/3552dc1c708c766eff1becfe57a38a20d0f8d592))
* **challenges:** add address validation and improve tests ([5c4db05](https://github.com/bitsocial/mintpass/commit/5c4db058127d9589b12f23d8175fe7210d4e2931))
* **challenges:** derive publications for vote/commentEdit/moderation/subplebbitEdit ([c3090ef](https://github.com/bitsocial/mintpass/commit/c3090ef1d66883bc33ae6061cb0e34c272f354d4))
* **challenges:** fix major publishing flow issues with shared plebbit instance and proper lifecycle management ([6fb58cf](https://github.com/bitsocial/mintpass/commit/6fb58cf0ec63fc3e0d609cca3e62371e5b1f1e6e))
* **challenges:** harden persistent binding init and portability ([e5e660e](https://github.com/bitsocial/mintpass/commit/e5e660ee1e60464a6b0304c23227846457ffabe2))
* **challenges:** improve test reliability with better error handling and unique data paths ([9fc2839](https://github.com/bitsocial/mintpass/commit/9fc2839a6a7f649c55188eb849f84697c04a33ea))
* **challenges:** remove test mocking, enable real RPC integration testing ([69501aa](https://github.com/bitsocial/mintpass/commit/69501aa4f412d0f21f8b05d76bc941673a4f0e0e))
* **challenges:** replace localhost with 127.0.0.1 for better environment compatibility ([396e218](https://github.com/bitsocial/mintpass/commit/396e218b0e6d4956c9e90a694dbed60b50f2c8b1))
* **contracts:** add missing type definitions for chai, mocha, and node ([0f1952d](https://github.com/bitsocial/mintpass/commit/0f1952deff371da0bd780ae5cf9250a5a30d0e8e))
* correct baseURI format and chainId in deployment scripts ([abf658c](https://github.com/bitsocial/mintpass/commit/abf658c26de9f7d2682210a3099367afad453b60))
* **package.json:** remove redundant dependency ([730ea1c](https://github.com/bitsocial/mintpass/commit/730ea1cb2e875fe3b189bcbbc189c2b897aef2f1))
* pass wallet info to challenge during createComment instead of after ([d3b96d8](https://github.com/bitsocial/mintpass/commit/d3b96d843b748c69bc60f750fe111be34aed62c8))
* remove explicit types array from tsconfig to resolve IDE type errors ([60686ba](https://github.com/bitsocial/mintpass/commit/60686baa5cde8e5513b572f9bca6a0a9057037e3))
* replace challengeverification event waiting with publishing state completion ([d18554f](https://github.com/bitsocial/mintpass/commit/d18554fb88996af8529d123a706e0b362c4a5f6a))
* **request:** derive eligibility from last checked inputs ([d0a8648](https://github.com/bitsocial/mintpass/commit/d0a8648ed58818d29992f3b0da786f95d689e826))
* resolve kubo shutdown during subplebbit creation ([399c9a9](https://github.com/bitsocial/mintpass/commit/399c9a96dfb00893af4a37126e4333dd60c05fd1))
* resolve TypeScript build errors in challenges package ([9923f36](https://github.com/bitsocial/mintpass/commit/9923f36ef13305f32e7a3a576b35baf38c5fd75d))
* **test:** add ETH wallet derivation ([40366d7](https://github.com/bitsocial/mintpass/commit/40366d7086b49d06f891b2957f5dbb99e5a75e6c))
* **test:** implement correct plebbit options and improve test reliability ([4c61a6c](https://github.com/bitsocial/mintpass/commit/4c61a6ccee97bc409e84f478bc3270d7c84e9c14))
* **test:** improve network error handling ([78b8c22](https://github.com/bitsocial/mintpass/commit/78b8c226593a7d717cd5d4f932c2b586b44f32d4))
* use dynamic path for mintpass challenge in tests ([d6f5f19](https://github.com/bitsocial/mintpass/commit/d6f5f19d96a1c4edc51bc3231b3afc2aab1b0cb3))
* **web/hexagon-background:** prevent stuck active hexes with hard expiry and flush ([2d59edc](https://github.com/bitsocial/mintpass/commit/2d59edca8b00ba12ee2088485c3114ecd4a3f5e6))
* **web/request:** prevent terms/privacy links from toggling checkboxes ([9c0535b](https://github.com/bitsocial/mintpass/commit/9c0535bb251c1a3aa101c60e77f609f99db21c22))
* **web:** 404 countdown uses single interval and redirects once ([e335122](https://github.com/bitsocial/mintpass/commit/e335122b0e18db7cbadf195c363523591558d82e))
* **web:** add “View transaction” button on success and remove Home ([570e434](https://github.com/bitsocial/mintpass/commit/570e434bba018a7c68b62fd80e25d0a9247e560b))
* **web:** add autofocus to otp input ([df8bcf6](https://github.com/bitsocial/mintpass/commit/df8bcf6147763ab68652bc18b29421c0e120a726))
* **web:** add full width styling to verify & mint button ([d8b8812](https://github.com/bitsocial/mintpass/commit/d8b8812ccbbf4d63a8f647cbebc1912871942185))
* **web:** add missing caret-blink animation for Input OTP component ([cb3d9eb](https://github.com/bitsocial/mintpass/commit/cb3d9eb26e6b0a2d98d186b1c26d5a61fa5ed62a))
* **web:** add missing implementation of PageCard component for consistent UI across pages ([70dd4c1](https://github.com/bitsocial/mintpass/commit/70dd4c149ffefb98e903654981e455827366fa1d))
* **web:** add ref-based mechanism to disable autofocus in country selector, overriding cmdk's default behavior ([afabf33](https://github.com/bitsocial/mintpass/commit/afabf335783d01ed187d069bbf69f6f6dd54d197))
* **web:** add view transitions types and improve theme toggler accessibility ([7ec5ae4](https://github.com/bitsocial/mintpass/commit/7ec5ae4be7a4c522d3f9648163479d17789539fa))
* **web:** animation wasn't working in production build because the definition was missing in tailwind config ([f48c167](https://github.com/bitsocial/mintpass/commit/f48c16792f36febfc9e68ef3fd6c65ebccbfa98e))
* **web:** avoid undefined overrides in ethers v6 mint call ([02bc3b5](https://github.com/bitsocial/mintpass/commit/02bc3b573cf8697eb2131c1e354502656747e9e4))
* **web:** bypass disposable/VOIP phone block on preview, keep prod strict ([19875a1](https://github.com/bitsocial/mintpass/commit/19875a140dc92be1dff65ac64821d82f1bbfa170))
* **web:** derive clear-user debug counts ([9ec88e4](https://github.com/bitsocial/mintpass/commit/9ec88e41837dc36b1e1c5b908957f8e1e43b40b2))
* **web:** disable OTP input during verification loading ([39a9223](https://github.com/bitsocial/mintpass/commit/39a92233d53423f5d5d4c9e5d7015ebbaa5767d4))
* **web:** enhance PageCard with dynamic font sizing and adopt in index.tsx ([c1b2875](https://github.com/bitsocial/mintpass/commit/c1b287521aa0b5db17fceea49ab44a74d1d879b9))
* **web:** extend hexagon background to full document height ([a5bc9b3](https://github.com/bitsocial/mintpass/commit/a5bc9b32cb9b6cefe09636364f440c51e1087876))
* **web:** handle number type in Set-Cookie header for admin auth ([420df2e](https://github.com/bitsocial/mintpass/commit/420df2ecb41945c12bff88c198ecf1127df7696a))
* **web:** harden admin auth and middleware; scope secrets server-only ([a486fed](https://github.com/bitsocial/mintpass/commit/a486fed1e9d82fab4ddb24f1b65bdf8bedd91220))
* **web:** harden admin auth, improve observers, validate targetIp, and UI error handling ([c71463a](https://github.com/bitsocial/mintpass/commit/c71463adb18c4b633710274b43b1d32caf0551ca))
* **web:** harden admin endpoints, cache headers; UI robustness fixes ([74bae64](https://github.com/bitsocial/mintpass/commit/74bae648d8337f2c535a81d991119f90e044fde9))
* **web:** harden admin env and UI edge cases; add logout CSRF check; improve dark palette ([e1e0417](https://github.com/bitsocial/mintpass/commit/e1e041722efbeabfa9dca076827c50c964c25b9a))
* **web:** harden admin secret usage, guard theme toggle, validate inputs ([e8ff6a6](https://github.com/bitsocial/mintpass/commit/e8ff6a663bb5e0f1f7abe7591e8fa11d4249699b))
* **web:** harden cooldown env parsing with safe defaults ([f94b64a](https://github.com/bitsocial/mintpass/commit/f94b64acd0fbad60a57d6bcb86d1edfe685485d8))
* **web:** harden edge admin token validation (iat/exp, base64url/hex) ([60b0a81](https://github.com/bitsocial/mintpass/commit/60b0a811ec55dff49e1cdc585f92e32f1294ad92))
* **web:** harden mint gas estimation and proceed without overrides on fail ([2eb6430](https://github.com/bitsocial/mintpass/commit/2eb64304009230cf2291d78ad276cd67f98cbe61))
* **web:** improve desktop layout with wider card and header spacing ([1002363](https://github.com/bitsocial/mintpass/commit/1002363bfcfe3f4211c9c851944fcb95ebfc5f9b))
* **web:** improve session/csrf/audit hardening; clean UI handlers; build passes ([b0664db](https://github.com/bitsocial/mintpass/commit/b0664dbf909c4ed0f3ec2f7a91d9eff8504bb665))
* **web:** limit PageCard max-width to prevent excessive stretching on desktop ([1c9c3e2](https://github.com/bitsocial/mintpass/commit/1c9c3e2726e85e348021705ef4bc62fd5781f3c3))
* **web:** make dark mode class-based so theme toggler wins ([532f1b6](https://github.com/bitsocial/mintpass/commit/532f1b64fa84474514b3df41b3c17c430c72fe09))
* **web:** make terms and privacy info text smaller ([cfe9c00](https://github.com/bitsocial/mintpass/commit/cfe9c00fa1bcc8baae798519336f8a47d1cb8688))
* **web:** normalize OTP comparison in verify to string equality ([94352fe](https://github.com/bitsocial/mintpass/commit/94352fe926ed8d4b342954a34214efa8af3b086a))
* **web:** prefer receipt.transactionHash for txHash in mint route ([4f6574e](https://github.com/bitsocial/mintpass/commit/4f6574e9031d755ea5c66e84008bd6e68df70a67))
* **web:** prevent admin clear-user double submit crash and improve errors ([945720c](https://github.com/bitsocial/mintpass/commit/945720ce983e9683b29e3bcab93f75f943fe8f8f))
* **web:** prevent caching transient SMS status that blocks final error messages ([957bee6](https://github.com/bitsocial/mintpass/commit/957bee6fee8d6a078323e828a35de63479885b92))
* **web:** prevent mobile keyboard auto-popup in phone input country selector ([4aacb02](https://github.com/bitsocial/mintpass/commit/4aacb02e88005015a9656350fdd35aac47d83c70))
* **web:** prevent mobile keyboard flash in phone input country selector ([6235e20](https://github.com/bitsocial/mintpass/commit/6235e20d138e82a6d3a6f569a8dbc31e0da0c3ef))
* **web:** propagate SMS provider errors and add timeouts to prevent hangs ([ac7ded0](https://github.com/bitsocial/mintpass/commit/ac7ded0ca2d5da1d23bad5821fd9c85cc93097c0))
* **web:** reduce SMS polling timeout to 30 seconds ([15b43cd](https://github.com/bitsocial/mintpass/commit/15b43cdbb9759f08983e2445ee56524c82418b22))
* **web:** remove intermediate SMS sending step and fix delivery confirmation flow ([9f701d8](https://github.com/bitsocial/mintpass/commit/9f701d821f87686fa2341123d502141a44cf17d4))
* **web:** replace non-null assertion with requireEnv in mint API ([a6dd1bd](https://github.com/bitsocial/mintpass/commit/a6dd1bd5956032b6c6ba04eccb0818ff99817dd7))
* **web:** robust TTL parsing for cooldowns with integer coercion ([c696b85](https://github.com/bitsocial/mintpass/commit/c696b852651c2b7fdb6f81203245a11e7f474d2f))
* **web:** skip Twilio StatusCallback when on localhost; use https in prod ([af6899b](https://github.com/bitsocial/mintpass/commit/af6899b3654638f61d607fc0c3bd26c51ec9157a))
* **web:** smoke test HMAC fallback via Node when OpenSSL missing ([5f3a88b](https://github.com/bitsocial/mintpass/commit/5f3a88b18f183d6f2099fb6fd0730b86bd60dfd8))
* **web:** treat KV verified marker as string or number ([6ca8db8](https://github.com/bitsocial/mintpass/commit/6ca8db858ddb48f8faa7ade3b735b368bb018c65))


### Features

* add custom CREATE2 factory for deterministic L2 deployments ([6c7cc6d](https://github.com/bitsocial/mintpass/commit/6c7cc6d645ae1b14cc7873d63bc8f404e48bcdb9))
* add remote node RPC testing with environment variables ([59c5b0e](https://github.com/bitsocial/mintpass/commit/59c5b0eb6b655a372aec1a9bfae44886a6423536))
* add reusable contract testing script for deployed instances ([f720181](https://github.com/bitsocial/mintpass/commit/f7201810f313ff32e830b1cdd208feef31b92503))
* add scripts and documentation for deployment ([22a532c](https://github.com/bitsocial/mintpass/commit/22a532cb5e46d841a34a8d4cb0e75b8c4f349a7f))
* add test mode mocking for MintPass challenge in isolated environments ([31d7d2e](https://github.com/bitsocial/mintpass/commit/31d7d2e3f2203240c83bf63b8a6493d8a6509041))
* **admin console:** clear IP cooldowns ([4e91b24](https://github.com/bitsocial/mintpass/commit/4e91b2459b67b65b5b16d47913c639cd2aa08202))
* **challenge:** bind NFT tokenId to first author per sub (toggle) ([35be868](https://github.com/bitsocial/mintpass/commit/35be868f8a9f777937b732b5fcc84cfabf91ee8b))
* **challenge:** default contract per chain and base↔eth wallet fallback ([ee5611a](https://github.com/bitsocial/mintpass/commit/ee5611ab3be6f2d7766da1f72d59591d96220352))
* **challenges:** add automated test script with node management ([a72e939](https://github.com/bitsocial/mintpass/commit/a72e9390d935d712d16fbc20d8d1e81337f53fb2))
* **challenges:** add comprehensive test suite with 20 additional test cases ([099ce75](https://github.com/bitsocial/mintpass/commit/099ce755662c51fd333122e1673f2b705ab10e91))
* **challenges:** add local Kubo node testing setup ([b16a6c6](https://github.com/bitsocial/mintpass/commit/b16a6c681b25a71ef330ffdaed18c0217e8085fa))
* **challenges:** complete automated MintPass integration testing with full publishing flow ([fa37885](https://github.com/bitsocial/mintpass/commit/fa37885215d084b5282cd06507a9dc83582abe27))
* **challenges:** implement automated MintPass challenge logic tests ([95320b9](https://github.com/bitsocial/mintpass/commit/95320b9095467f8b13e7cf81ed7ccfd4d17d3815))
* **challenges:** implement mintpass challenge for plebbit-js integration ([c0cf6c4](https://github.com/bitsocial/mintpass/commit/c0cf6c4b529e149ee4c740e712cf6b6120b4519e))
* **challenges:** publish v1 artifacts and add subpath export ([e740794](https://github.com/bitsocial/mintpass/commit/e740794e6605fb4cf1136d8680ecbf54c980ff54))
* **challenges:** publishable npm package with dist-only files ([9505877](https://github.com/bitsocial/mintpass/commit/95058775eb1ef7a678cac146a969748e50ea4fb5))
* **challenges:** replace private LRU with Keyv+SQLite under env-paths data dir ([6dccb86](https://github.com/bitsocial/mintpass/commit/6dccb866cdb3fd9b12f80d876e0270ba6947262b))
* **challenges:** set requireAuthorMatch=true by default with stronger warning ([62ebe56](https://github.com/bitsocial/mintpass/commit/62ebe56039614cb05e93200ea8fff0abccae81ed))
* complete MintPassV1 contract with admin-mutable fields ([e741d13](https://github.com/bitsocial/mintpass/commit/e741d138678e7e64a8dc8de5b17df438af0d7af5))
* **contracts,web,challenge:** add author-bound MintPassV2 and optional author match ([71c6e27](https://github.com/bitsocial/mintpass/commit/71c6e27cacf04fde7e9232a6000ddb52f7284b56))
* **deploy.ts:** add vanity address mining to get address starting with "9A55" ([9b9e620](https://github.com/bitsocial/mintpass/commit/9b9e620b10f07cf7ae2895a86a6503cbd9a06a94))
* implement deterministic deployment system with CREATE2 ([8674d3a](https://github.com/bitsocial/mintpass/commit/8674d3a35e72bcd1c1eff22fab6e406b3d57af8e))
* initial MintPassV1 contract and project setup ([94dc933](https://github.com/bitsocial/mintpass/commit/94dc933767d06a1fdc981a6ecf288c25c8ac51fb))
* **web,header:** replace Privacy and Terms links with Updates link ([b1a3afe](https://github.com/bitsocial/mintpass/commit/b1a3afec12eaaea5c1b8003f7b861eed5caa847e))
* **web:** add 404 page ([faf9e83](https://github.com/bitsocial/mintpass/commit/faf9e8392b94a86c2d076fe88c4c0b1beccc61a1))
* **web:** add admin console ([3759364](https://github.com/bitsocial/mintpass/commit/375936483685af124fb7d3a995720047d40ef728))
* **web:** add animated rainbow button in homepage ([fac7c2c](https://github.com/bitsocial/mintpass/commit/fac7c2cd2bf8e8478e7084c129b520967a58d695))
* **web:** add animation to theme toggler ([cc31d6e](https://github.com/bitsocial/mintpass/commit/cc31d6e065fedf9fa10b7ff76c9a640268643c60))
* **web:** add auto redirect in 404 page ([18f2889](https://github.com/bitsocial/mintpass/commit/18f2889212c59329d570f3dbb6a9d43288e1822c))
* **web:** add carrier rates disclaimer to consent on request page ([5cd9222](https://github.com/bitsocial/mintpass/commit/5cd9222cc593178dc7d6394bfc793f761d171111))
* **web:** add confetti celebration animation with success messaging for NFT completion ([2fb524a](https://github.com/bitsocial/mintpass/commit/2fb524a772113df407d2faf0a76aec7daa4f924d))
* **web:** add configurable NFT terminology and demo modes ([ca923b1](https://github.com/bitsocial/mintpass/commit/ca923b1a9fffbe535fb6b1480d0a8ea7a0354c13))
* **web:** add dark mode with toggle and default to system theme ([667f9bf](https://github.com/bitsocial/mintpass/commit/667f9bf855eb4308b9923d2270017b75e6bbbcda))
* **web:** add footer ([f378dde](https://github.com/bitsocial/mintpass/commit/f378ddee0e81b861174a616dfc2b818031012aad))
* **web:** add hexagon background ([7f870d8](https://github.com/bitsocial/mintpass/commit/7f870d86cac9079f5be1e46caa487d5124737661))
* **web:** add hide-address query parameter for flexible address input control ([0a60be5](https://github.com/bitsocial/mintpass/commit/0a60be56ebe2daceff4700a6cfd5e0243a10c34a))
* **web:** add initial UI ([295f6c0](https://github.com/bitsocial/mintpass/commit/295f6c0ec613c471fd966f953b4c767b1cd59faf))
* **web:** add mintpass logo to header ([fdaa6fa](https://github.com/bitsocial/mintpass/commit/fdaa6fa3fb01c78abf50eba3b3d36a88c037e8d1))
* **web:** add navigation protection during SMS verification process ([d876154](https://github.com/bitsocial/mintpass/commit/d876154594e22e6d9c9fbca131e3a57720baeeda))
* **web:** add phone picker to admin console and improve debug messaging ([13123a0](https://github.com/bitsocial/mintpass/commit/13123a0a04c336f44e56a90f6e88fcc7a5e53f89))
* **web:** add preview-only SMOKE_TEST_TOKEN to echo OTP for smoke tests ([58b365d](https://github.com/bitsocial/mintpass/commit/58b365de7f4c15c0bed08f25072ce44c6813f8d2))
* **web:** add Privacy/Terms pages and require consent before eligibility ([0d1aed9](https://github.com/bitsocial/mintpass/commit/0d1aed9b213db663ba42072f28ad4da866fb3a67))
* **web:** add SMS cooldown countdown timer with live updates ([3de1848](https://github.com/bitsocial/mintpass/commit/3de1848453191c70c35a3ba3d2bee604f1f8928a))
* **web:** add specific error messages for mint eligibility failures ([67a0063](https://github.com/bitsocial/mintpass/commit/67a0063aa0cb7137ee42a318c208823be7272748))
* **web:** add Twilio SMS timeout/retry and harden Base Sepolia mint ([a50f342](https://github.com/bitsocial/mintpass/commit/a50f3421429cb026a62d24d3a360ac578c756ae7))
* **web:** allow admin to clear IP cooldowns via phone/address; index IPs ([60a4435](https://github.com/bitsocial/mintpass/commit/60a44357553679669178bf6336f7a88aa16b6819))
* **web:** auto-submit OTP to verify & mint on completion ([ed74af5](https://github.com/bitsocial/mintpass/commit/ed74af5dcc1a8303cfe4b09b9fd04510aa7c64b9))
* **web:** disable address and phone inputs during SMS sending ([70d5a09](https://github.com/bitsocial/mintpass/commit/70d5a09ca861c8016241ff58593c88229e8bb9b4))
* **web:** enforce SMS and mint cooldowns; support Cloudflare IP; update anti-sybil docs ([476c05c](https://github.com/bitsocial/mintpass/commit/476c05cc8143f524ca0234d60a9fd03fe0932d1f))
* **web:** gate admin console with secure session, edge middleware, and login ([c506116](https://github.com/bitsocial/mintpass/commit/c506116b9224160afbc7d845fa5c343c948ea43f))
* **web:** gate OTP step on Twilio delivered status and show errors ([fc689b1](https://github.com/bitsocial/mintpass/commit/fc689b133b0429c03d5a7a1bb0a1867d4200d8d6))
* **web:** handle unsupported countries in phone number input gracefully ([d0252a6](https://github.com/bitsocial/mintpass/commit/d0252a6a808d6b4a545f270f3353cd4d5af26327))
* **web:** hide address field when prefilled from query string ([8128233](https://github.com/bitsocial/mintpass/commit/81282333e20dc360262b27ea21d30f7e63a3a677))
* **web:** HMAC-pepper hashing for phone/IP KV keys and rate-limits ([a4b3cef](https://github.com/bitsocial/mintpass/commit/a4b3cefea8ff893fd2f31991fe87aab1a243612b))
* **web:** implement comprehensive favicon system with cross-platform support ([5a536a6](https://github.com/bitsocial/mintpass/commit/5a536a627dd0ff5aeca258998ec3d200d55c99a5))
* **web:** implement explicit two-step eligibility check to prevent SMS waste ([e1571ef](https://github.com/bitsocial/mintpass/commit/e1571ef2b2468b87caee104a3c2bdf85f61dae03))
* **web:** initialize Milestone 3 backend (KV, rate limit, SMS) with IP/phone risk checks ([0e9fcfc](https://github.com/bitsocial/mintpass/commit/0e9fcfcbd31cf383dd707c05e43ed9129cc6ee43))
* **web:** integrate Twilio SMS and env‑gated Base Sepolia mint; add iad1 region config and docs ([1a27284](https://github.com/bitsocial/mintpass/commit/1a27284000298264b0c4b63c783074a737e5a79a))
* **web:** mark Twilio done; harden web APIs with global IP limits ([102178b](https://github.com/bitsocial/mintpass/commit/102178bd01c3981b5d13edac3671041a62dd1b04))
* **web:** optimize phone input dropdown size and country selection ([6e8dc8f](https://github.com/bitsocial/mintpass/commit/6e8dc8f1bb2f25a1cf2dc64bd42f4ee43c942438))
* **web:** preview smoke helpers (bypass+debug) and script integration ([a7e667a](https://github.com/bitsocial/mintpass/commit/a7e667a24edf448b421cbf94e2ace9e0c908c662))
* **web:** remove country restrictions from phone input ([baa48d4](https://github.com/bitsocial/mintpass/commit/baa48d44fe92fe6f0db40d6ac30708cf455fab9a))
* **web:** rename address parameter to eth-address for better specificity ([bf58046](https://github.com/bitsocial/mintpass/commit/bf58046a55603f85d0bf66223218bac52e3ab204))
* **web:** replace manual phone input with professional country picker component ([2263032](https://github.com/bitsocial/mintpass/commit/226303210ee9bafb9bfa5bedda70a59578ac36e9))
* **web:** replace SMS code input with professional OTP component for better UX ([b605d15](https://github.com/bitsocial/mintpass/commit/b605d159b22f05b6924d531e48b292bea610c53f))
* **web:** replace verify button with instructional text in OTP step ([cde7891](https://github.com/bitsocial/mintpass/commit/cde7891707b8a4800ab729f00071c70908cb1ac0))
* **web:** streamline request form UX with conditional address display and simplified terms ([89761b2](https://github.com/bitsocial/mintpass/commit/89761b2c9eac18ba2ab03aa40717dd68d28fe42f))
* **web:** update primary button colors to custom teal theme ([e72a559](https://github.com/bitsocial/mintpass/commit/e72a559b38bd0aec606c0fdfe8498521164d2c06))


### Performance Improvements

* **challenges:** add zombie process prevention to test script ([a13f1f0](https://github.com/bitsocial/mintpass/commit/a13f1f083d565250a93939df0fd5ba039e187b3a))
* **challenges:** improve test script cleanup and process management ([696f55f](https://github.com/bitsocial/mintpass/commit/696f55f2d44803c91498fbfa46b3fbb0f2d415be))
* **web:** optimize logo caching to prevent reloads during navigation ([0f32fc5](https://github.com/bitsocial/mintpass/commit/0f32fc5f8222149092078e282949204798e7a18c))



