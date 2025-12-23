import {
  type GameConfig,
  gamesTable,
  mapsTable,
  type StatSchema,
} from "../src/db/schema";
import db from "../src/index";

async function main() {
  console.log("🌱 Starting Seed...");

  const overwatchStatSchema: StatSchema = [
    { key: "eliminations", label: "ELIMS", type: "number" },
    { key: "deaths", label: "DEATHS", type: "number" },
    { key: "assists", label: "ASSISTS", type: "number" },
    { key: "damage_dealt", label: "DMG", type: "number" },
    { key: "healing_done", label: "HEAL", type: "number" },
    { key: "damage_mitigated", label: "MIT", type: "number" },
  ];

  const overwatchMetadata: GameConfig = {
    roles: ["Tank", "Damage", "Support"],
    modes: [
      {
        slug: "control",
        name: "Control",
        teamSize: 5,
        allowedMaps: [
          "antarctic-peninsula",
          "busan",
          "ilios",
          "lijiang-tower",
          "nepal",
          "oasis",
          "samoa",
        ],
      },
      {
        slug: "escort",
        name: "Escort",
        teamSize: 5,
        allowedMaps: [
          "circuit-royal",
          "dorado",
          "havana",
          "junkertown",
          "rialto",
          "route-66",
          "shambali-monastery",
          "watchpoint-gibraltar",
        ],
      },
      {
        slug: "flashpoint",
        name: "Flashpoint",
        teamSize: 5,
        allowedMaps: ["aatlis", "new-junk-city", "suravasa"],
      },
      {
        slug: "hybrid",
        name: "Hybrid",
        teamSize: 5,
        allowedMaps: [
          "blizzard-world",
          "eichenwalde",
          "hollywood",
          "kings-row",
          "midtown",
          "numbani",
          "paraiso",
        ],
      },
      {
        slug: "push",
        name: "Push",
        teamSize: 5,
        allowedMaps: ["colosseo", "esperanca", "new-queen-street", "runasapi"],
      },
      {
        slug: "clash",
        name: "Clash",
        teamSize: 5,
        allowedMaps: ["hanaoka", "throne-of-anubis"],
      },
    ],
  };

  console.log("🎮 Upserting Overwatch 2...");

  const [insertedGame] = await db
    .insert(gamesTable)
    .values({
      name: "Overwatch 2",
      slug: "overwatch-2",
      logoUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/0/09/Overwatch_logo.png/revision/latest?cb=20221010160653",
      metadata: overwatchMetadata,
      statSchema: overwatchStatSchema,
      statSchemaVersion: 1,
    })
    .onConflictDoUpdate({
      target: gamesTable.slug,
      set: {
        metadata: overwatchMetadata,
        statSchema: overwatchStatSchema,
        statSchemaVersion: 1,
      },
    })
    .returning();

  if (!insertedGame) {
    console.error("❌ Failed to upsert game.");
    process.exit(1);
  }

  const mapsToInsert = [
    // --- CONTROL ---
    {
      name: "Antarctic Peninsula",
      slug: "antarctic-peninsula",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/7/7c/Antarctic_Peninsula_1.png/revision/latest/scale-to-width-down/1000?cb=20230208020804",
    },
    {
      name: "Busan",
      slug: "busan",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/0/09/Overwatch_Busan.jpg/revision/latest/scale-to-width-down/1000?cb=20190412043201",
    },
    {
      name: "Ilios",
      slug: "ilios",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/4/45/Ilios.jpg/revision/latest/scale-to-width-down/1000?cb=20180520062425",
    },
    {
      name: "Lijiang Tower",
      slug: "lijiang-tower",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/9/9b/Lijiang_Tower_loading_screen.jpg/revision/latest/scale-to-width-down/1000?cb=20180520062020",
    },
    {
      name: "Nepal",
      slug: "nepal",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/f/f3/Nepal_loading_screen.jpg/revision/latest/scale-to-width-down/1000?cb=20190412043102",
    },
    {
      name: "Oasis",
      slug: "oasis",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/f/fc/Oasis.jpg/revision/latest/scale-to-width-down/1000?cb=20180520062749",
    },
    {
      name: "Samoa",
      slug: "samoa",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/b/b4/Samoa.jpg/revision/latest?cb=20231002031650",
    },

    // --- ESCORT (Payload) ---
    {
      name: "Circuit Royal",
      slug: "circuit-royal",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/10/Monte_Carlo.jpg/revision/latest/scale-to-width-down/1000?cb=20220926230154",
    },
    {
      name: "Dorado",
      slug: "dorado",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/e/ec/Dorado-streets2.jpg/revision/latest/scale-to-width-down/1000?cb=20180520045217",
    },
    {
      name: "Havana",
      slug: "havana",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/9/93/Havana.png/revision/latest/scale-to-width-down/1000?cb=20190512033804",
    },
    {
      name: "Junkertown",
      slug: "junkertown",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/e/e3/Junkertown.jpg/revision/latest/scale-to-width-down/1000?cb=20170822090741",
    },
    {
      name: "Rialto",
      slug: "rialto",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/f/ff/Rialto.jpg/revision/latest/scale-to-width-down/1000?cb=20190412043512",
    },
    {
      name: "Route 66",
      slug: "route-66",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/a/a6/Route_66.jpg/revision/latest/scale-to-width-down/1000?cb=20180520050707",
    },
    {
      name: "Shambali Monastery",
      slug: "shambali-monastery",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/8/81/ShambaliEscort.png/revision/latest/scale-to-width-down/1000?cb=20230421235244",
    },
    {
      name: "Watchpoint: Gibraltar",
      slug: "watchpoint-gibraltar",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/8/8b/Gibraltar.jpg/revision/latest/scale-to-width-down/1000?cb=20180520050120",
    },

    // --- FLASHPOINT ---
    {
      name: "Aatlis",
      slug: "aatlis",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/e/e6/Aatlis_loading_screen.png/revision/latest/scale-to-width-down/1000?cb=20250624194631",
    },
    {
      name: "New Junk City",
      slug: "new-junk-city",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/a/ae/New_Junk_City.jpg/revision/latest?cb=20240419094558",
    },
    {
      name: "Suravasa",
      slug: "suravasa",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/6/6f/Suravasa.jpg/revision/latest/scale-to-width-down/1000?cb=20230622084852",
    },

    // --- HYBRID ---
    {
      name: "Blizzard World",
      slug: "blizzard-world",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/f/f8/Blizzard_World.jpg/revision/latest/scale-to-width-down/1000?cb=20190401012157",
    },
    {
      name: "Eichenwalde",
      slug: "eichenwalde",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/a/aa/Eichenwalde.png/revision/latest/scale-to-width-down/1000?cb=20190412043329",
    },
    {
      name: "Hollywood",
      slug: "hollywood",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/2/26/Hollywood-set.jpg/revision/latest/scale-to-width-down/1000?cb=20190506201443",
    },
    {
      name: "King's Row",
      slug: "kings-row",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/1b/King%27s_Row_concept.jpg/revision/latest/scale-to-width-down/1000?cb=20180520052818",
    },
    {
      name: "Midtown",
      slug: "midtown",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/4/4e/N18S6DCTDPG81613669123002.png/revision/latest/scale-to-width-down/1000?cb=20210221175110",
    },
    {
      name: "Numbani",
      slug: "numbani",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/1b/Numbani_Loading_Screen.jpg/revision/latest/scale-to-width-down/1000?cb=20180520055541",
    },
    {
      name: "Paraíso",
      slug: "paraiso",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/9/90/Para%C3%ADso_pvp.jpg/revision/latest/scale-to-width-down/1000?cb=20220630025520",
    },

    // --- PUSH ---
    {
      name: "Colosseo",
      slug: "colosseo",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/1/1e/Blizzconline_rome_01.png/revision/latest/scale-to-width-down/1000?cb=20220926222702",
    },
    {
      name: "Esperança",
      slug: "esperanca",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/f/f5/PortugalPush.jpg/revision/latest/scale-to-width-down/1000?cb=20220926215956",
    },
    {
      name: "New Queen Street",
      slug: "new-queen-street",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/9/91/Toronto.jpg/revision/latest/scale-to-width-down/1000?cb=20220926222923",
    },
    {
      name: "Runasapi",
      slug: "runasapi",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/0/07/Runasapi_2.jpg/revision/latest/scale-to-width-down/1000?cb=20240623180847",
    },

    // --- CLASH (Nouveau Mode) ---
    {
      name: "Hanaoka",
      slug: "hanaoka",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/3/39/Hanaoka_2.jpg/revision/latest/scale-to-width-down/1000?cb=20231105081811",
    },
    {
      name: "Throne of Anubis",
      slug: "throne-of-anubis",
      imageUrl:
        "https://static.wikia.nocookie.net/overwatch_gamepedia/images/a/ab/Throne_of_Anubis.png/revision/latest/scale-to-width-down/1000?cb=20241111080124",
    },
  ];

  console.log(`🗺️  Syncing ${mapsToInsert.length} Maps...`);

  for (const map of mapsToInsert) {
    await db
      .insert(mapsTable)
      .values({
        gameId: insertedGame.id,
        name: map.name,
        slug: map.slug,
        imageUrl: map.imageUrl,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [mapsTable.gameId, mapsTable.slug],
        set: {
          name: map.name,
          imageUrl: map.imageUrl,
          isActive: true,
        },
      });
  }

  console.log("✅ Seeding Complete! Database is ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding Failed:", err);
  process.exit(1);
});
