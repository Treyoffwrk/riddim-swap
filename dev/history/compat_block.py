# ---- older iPhones (iOS 15.4–17): fallbacks for the few style features they lack ---------------------------------------------
rep(""".swipe-col{overflow-x:clip;position:relative}""",""".swipe-col{overflow-x:hidden;overflow-x:clip;position:relative}   /* clip needs iOS 16; hidden is the fallback */""")
rep("""body.bv-calm .beats.d i.on{background:color-mix(in srgb,var(--dance) 35%,var(--sunk));""","""body.bv-calm .beats.d i.on{background:#2E3A63;background:color-mix(in srgb,var(--dance) 35%,var(--sunk));""")
rep("""body.bv-calm .beats.s i.on{background:color-mix(in srgb,var(--song-hot) 35%,var(--sunk));""","""body.bv-calm .beats.s i.on{background:#5A4527;background:color-mix(in srgb,var(--song-hot) 35%,var(--sunk));""")
