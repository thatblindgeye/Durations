const Durations = (function () {
  "use strict";

  const VERSION = "1.0";
  const PREFIX = "!durations";
  const LAST_UPDATED = 1668283397577;
  const DURATION_DISPLAY_NAME = `Durations v${VERSION}`;
  const COMMANDS = {
    ADD_DURATION: "add-duration",
    ADD_GM_DURATION: "add-gmd",
    SHOW_GM_DURATIONS: "show-gmd",
    DELETE_GM_DURATION: "delete-gmd",
    CLEAR: "clear",
    CLEAR_TURNORDER: "clear-turnorder",
    SORT: "sort",
    SORT_TURNORDER: "sort-turnorder",
    CONFIG: "config",
  };

  const CONFIG_SETTINGS = {
    AUTO_CLEAR: "autoClearTurnorder",
    AUTO_DELETE: "autoDeleteDurations",
    ROUND_DISPLAY_NAME: "roundDisplayName",
  };

  const MACROS = {
    ADD_DURATION_MACRO: {
      name: "Durations-add",
      action: `${PREFIX} ${COMMANDS.ADD_DURATION}|?{Duration name}|?{Duration length}|?{Insert at initiative}`,
    },
    ADD_GM_DURATION_MACRO: {
      name: "Durations-add-gmDuration",
      action: `${PREFIX} ${COMMANDS.ADD_GM_DURATION}|?{GM duration description}|?{GM duration length}`,
    },
    SHOW_GM_DURATIONS_MACRO: {
      name: "Durations-show-gmDurations",
      action: `${PREFIX} ${COMMANDS.SHOW_GM_DURATIONS}`,
    },
    CLEAR_MACRO: {
      name: "Durations clear-turnorder",
      action: `${PREFIX} ${COMMANDS.CLEAR}`,
    },
    SORT_MACRO: {
      name: "Durations-sort-turnorder",
      action: `${PREFIX} ${COMMANDS.SORT}|?{Starting round}|?{Round formula}|?{Sort order|Ascending|Descending}`,
    },
    CONFIG_MACRO: {
      name: "Durations-config",
      action: `${PREFIX} ${COMMANDS.CONFIG}`,
    },
  };

  const DEFAULT_STATE = {
    gmDurations: [],
    roundDisplayName: "<= Round =>",
    isTurnorderSorted: false,
    autoDeleteDurations: true,
    autoClearTurnorder: true,
    version: VERSION,
  };

  function createMacros() {
    const gmPlayers = _.filter(
      findObjs({
        _type: "player",
      }),
      (player) => playerIsGM(player.get("_id"))
    );

    _.each(MACROS, (macro) => {
      createObj("macro", {
        _playerid: gmPlayers[0].get("_id"),
        name: macro.name,
        action: macro.action,
        visibleto: _.pluck(gmPlayers, "id").join(","),
      });
    });
  }

  function getTurnorder() {
    const campaignTurnorder = Campaign().get("turnorder");

    if (campaignTurnorder === "") {
      return [];
    } else {
      return JSON.parse(campaignTurnorder);
    }
  }

  function setTurnOrder(turnorder) {
    Campaign().set("turnorder", JSON.stringify(turnorder));
  }

  function sendMessage(message) {
    sendChat(DURATION_DISPLAY_NAME, message, null, { noarchive: true });
  }

  function validateCommand(message) {
    const {
      ADD_DURATION,
      ADD_GM_DURATION,
      SHOW_GM_DURATIONS,
      DELETE_GM_DURATION,
      CLEAR,
      CLEAR_TURNORDER,
      SORT,
      SORT_TURNORDER,
      CONFIG,
    } = COMMANDS;

    const [prefix, ...options] = _.map(message.content.split("|"), (msgItem) =>
      msgItem.toLowerCase()
    );
    const command = prefix.split(" ")[1];

    if (!COMMANDS.includes(command)) {
      throw new Error(
        `<code>${command}</code> is not a valid command. Call the <code>!durations config</code> command for a list of valid commands.`
      );
    }
  }

  function clearTurnorder() {
    setTurnOrder([]);
    state.Durations.gmDurations = [];
    state.Durations.isTurnorderSorted = false;

    sendMessage(
      "/w gm The turnorder has been cleared and all GM durations have been deleted."
    );
  }

  function sortTurnorder(turnorder, roundStart, roundFormula, sortingOrder) {
    roundStart = roundStart || "1";
    roundFormula = roundFormula || "+1";
    sortingOrder = "descending";
    const { roundDisplayName, isTurnorderSorted } = state.Durations;

    const sortedTurnorder = _.map(
      _.filter(turnorder, (turnItem) => turnItem.custom !== roundDisplayName),
      (turnItem) => {
        if (!_.has(turnItem, "initiative")) {
          return { ...turnItem, initiative: parseFloat(turnItem.pr) };
        }

        return turnItem;
      }
    ).sort((turnItemA, turnItemB) =>
      sortingOrder.toLowerCase() === "descending"
        ? turnItemB.initiative - turnItemA.initiative
        : turnItemA.initiative - turnItemB.initiative
    );

    const roundTurnItem = _.find(
      turnorder,
      (turnItem) => turnItem.custom === roundDisplayName
    );

    const turnorderWithRound = [
      {
        id: "-1",
        pr: roundTurnItem ? roundTurnItem.pr : roundStart,
        custom: roundDisplayName,
        formula: roundTurnItem ? roundTurnItem.formula : roundFormula,
      },
      ...sortedTurnorder,
    ];

    if (!isTurnorderSorted || turnorder[0].custom === roundDisplayName) {
      if (!isTurnorderSorted) {
        state.Durations.isTurnorderSorted = true;
      }
      return turnorderWithRound;
    }

    const currentTurnIndex = _.findIndex(turnorderWithRound, (turnorderItem) =>
      _.isEqual(turnorderItem, turnorder[0])
    );

    return [
      ...turnorderWithRound.slice(currentTurnIndex),
      ...turnorderWithRound.slice(0, currentTurnIndex),
    ];
  }

  function addDuration(name, length, insertAtInitiative = 0) {
    const turnorder = getTurnorder();
    const sortedTurnorder = sortTurnorder([
      ...turnorder,
      {
        custom: name,
        pr: length,
        id: "-1",
        initiative: parseFloat(insertAtInitiative),
        formula: "-1",
      },
    ]);

    setTurnOrder(sortedTurnorder);
  }

  function addGMDuration(description, length) {
    const newGMDurations = [
      ...state.Durations.gmDurations,
      {
        custom: description,
        pr: parseInt(length),
        formula: "-1",
        id: Date.now(),
      },
    ];

    state.Durations.gmDurations = newGMDurations;

    sendMessage(
      `/w gm The <code>${description}</code> GM duration has been added with a length of <code>${length}</code> round${
        length > 1 ? "s" : ""
      }.`
    );
  }

  function showGMDurations(gmDurationsToShow) {
    if (gmDurationsToShow.length) {
      let combinedDurationMessage = "";
      const groupedDurations = _.groupBy(gmDurationsToShow, "pr");

      for (const key in groupedDurations) {
        let groupMessage = "";
        const keyNumber = parseInt(key);

        _.each(groupedDurations[key], (groupItem) => {
          groupMessage += `<li style="margin: 5px 0;"><a href="!durations delete-gmd|${groupItem.id}">Delete</a> ${groupItem.custom}</li>`;
        });

        combinedDurationMessage += `<div style="border: 1px solid gray;padding: 5px; margin-bottom: 5px;"><div style="font-weight: bold;">${
          keyNumber < 0
            ? "A previous round"
            : keyNumber === 0
            ? "This round"
            : `In ${keyNumber} round${keyNumber > 1 ? "s" : ""}`
        }</div><ul>${groupMessage}</ul></div>`;
      }

      sendMessage(
        `/w gm <div><div style="font-size: 1.75rem; margin: 10px 0; font-weight: bold;">Current GM Durations</div>${combinedDurationMessage}</div>`
      );
    } else {
      sendMessage("/w gm There are currently no GM durations to show.");
    }
  }

  function deleteGMDuration(durationID) {
    const { gmDurations } = state.Durations;
    const deletedDuration = _.find(
      gmDurations,
      (duration) => duration.id === durationID
    );

    if (deletedDuration) {
      const gmDurationsAfterDelete = _.filter(
        gmDurations,
        (gmDuration) => gmDuration.id !== durationID
      );

      state.Durations.gmDurations = gmDurationsAfterDelete;

      if (gmDurationsAfterDelete.length) {
        showGMDurations(gmDurationsAfterDelete);
      }
      sendMessage(
        `/w gm The <code>${deletedDuration.custom}</code> GM duration has been deleted.`
      );
    } else {
      sendMessage(
        `/w gm Could not find a GM duration to delete with ID <code>${durationID}</code>.`
      );
    }
  }

  const configRowTemplate = _.template(
    "<tr style='border-bottom: 1px solid gray;'><td style='vertical-align: top; padding: 5px;'><%= commandCell %></td><td style='padding: 5px 5px 5px 10px;'><%= descriptionCell %></td></tr>"
  );

  function buildConfigDisplay() {
    const {
      ADD_DURATION,
      ADD_GM_DURATION,
      SHOW_GM_DURATIONS,
      CLEAR,
      SORT,
      CONFIG,
    } = COMMANDS;
    const { ROUND_DISPLAY_NAME, AUTO_CLEAR, AUTO_DELETE } = CONFIG_SETTINGS;
    const { roundDisplayName, autoClearTurnorder, autoDeleteDurations } =
      state.Durations;

    const tableHeader =
      "<thead><tr><th style='padding: 2px;'>Command</th><th style='padding: 2px 2px 2px 10px;'>Description</th></tr></thead>";

    const addDurationCells = configRowTemplate({
      commandCell: `<a href="!durations ${ADD_DURATION}|?{Duration name}|?{Duration length}|?{Insert at initiative}">Add Duration</a>`,
      descriptionCell: `<div><code>!durations ${ADD_DURATION}|[duration name]|[duration length]|[initiative]</code></div><br/><div>Adds a duration to the Roll20 turn tracker, visible to all players in the game. The turnorder is automatically sorted after adding a duration.</div><br/><div>This command accepts the following arguments when called: <ul><li><span style="font-weight: bold;">Name:</span> the name of the item that will appear in the turnorder.</li><li><span style="font-weight: bold;">Length:</span> how long the duration will last for.</li><li><span style="font-weight: bold;">Initiative:</span> where in the turnorder the duration will be placed. This argument defaults to an initiative of <code>0</code> when a value is not passed in.</li></ul></div>`,
    });

    const addGMDurationCells = configRowTemplate({
      commandCell: `<a href="!durations ${ADD_GM_DURATION}|?{GM duration description}|?{GM duration length}">Add GM Duration</a>`,
      descriptionCell: `<div><code>!durations ${ADD_GM_DURATION}|[duration description]|[duration length]</code></div><br/><div>Adds a private duration that can be seen only by the GM. All GM durations appear in the Roll20 chat when shown, which occurs at the start of each round or when the <code>!durations ${SHOW_GM_DURATIONS}</code> command is called.</div><br/><div>This command accepts the following arguments when called: <ul><li><span style="font-weight: bold;">Description:</span> a description of the GM duration, which can be more detailed than a public duration in the turn tracker.</li><li><span style="font-weight: bold;">Length:</span> how long the GM duration will last. The length of a GM duration will decrease by 1 at the start of each round.</li></ul></div>`,
    });

    const showGMDurationsCells = configRowTemplate({
      commandCell: `<a href="!durations ${SHOW_GM_DURATIONS}">Show GM Durations</a>`,
      descriptionCell: `<div><code>!durations ${SHOW_GM_DURATIONS}</code></div><br/>Shows the current GM durations as a whisper to the GM.`,
    });

    const clearDurationsCells = configRowTemplate({
      commandCell: `<a href="!durations ${CLEAR}">Clear Turnorder</a>`,
      descriptionCell: `<div><code>!durations ${CLEAR}</code></div><br/>Clears the turnorder and deletes all GM durations.`,
    });

    const sortDurationsCells = configRowTemplate({
      commandCell: `<a href="!durations ${SORT}|?{Starting round}|?{Round formula}|?{Sort order|Ascending|Descending}">Sort Turnorder</a>`,
      descriptionCell: `<div><code>!durations ${SORT}|[starting round]|[round formula]|[sort order]</code></div><br/><div>Sorts the turnorder, retaining the current turn.</div><br/><div>This command accepts the following arguments: <ul><li><span style="font-weight: bold;">Starting round:</span> the round number to start at when the turnorder is sorted for the first time after being cleared. This argument defaults to <code>1</code> when a value is not passed in.</li><li><span style="font-weight: bold;">Round formula:</span> the formula for adjusting the round number on each initiative pass. The value passed in must start with either a plus <code>+</code> or minus <code>-</code> sign, followed by a number. This argument defaults to a formula of <code>+1</code> when a value is not passed in.</li><li><span style="font-weight: bold;">Sort order:</span> determines what order to sort the turnorder in, and must be either <code>ascending</code> (lowest to highest) or <code>descending</code> (highest to lowest). This argument defaults to <code>descending</code> when a value is not passed in.</li></ul></div>`,
    });

    const roundNameCells = configRowTemplate({
      commandCell: `<a href="!durations ${CONFIG}|${ROUND_DISPLAY_NAME}|?{Round display name}">Round Display Name</a><div>Current setting: <code>${roundDisplayName}</code></div>`,
      descriptionCell: `<div><code>!durations ${CONFIG}|${ROUND_DISPLAY_NAME}|[new display name]</code></div><br/><div>The display name of the round item in the turnorder.</div><br/><div>When calling this command, lettercase must be retained for the <code>${ROUND_DISPLAY_NAME}</code> config setting in the command call.</div>`,
    });

    const autoClearCells = configRowTemplate({
      commandCell: `<a href="!durations ${CONFIG}|${AUTO_CLEAR}|${
        autoClearTurnorder ? "false" : "true"
      }">Auto Clear Turnorder</a><div>Current setting: <code>${
        autoClearTurnorder ? "Enabled" : "Disabled"
      }</code></div>`,
      descriptionCell: `<div><code>!durations ${CONFIG}|${AUTO_CLEAR}|[true or false]</code></div><br/><div>When this config setting is enabled, the turnorder will be cleared and all GM durations will be deleted whenever the turnorder is opened.</div><br/><div>When calling this command, lettercase must be retained for the <code>${AUTO_CLEAR}</code> config setting in the command call.</div>`,
    });

    const autoDeleteCells = configRowTemplate({
      commandCell: `<a href="!durations ${CONFIG}|${AUTO_DELETE}|${
        autoDeleteDurations ? "false" : "true"
      }">Auto Delete Durations</a><div>Current setting: <code>${
        autoDeleteDurations ? "Enabled" : "Disabled"
      }</code></div>`,
      descriptionCell: `<div><code>!durations ${CONFIG}|${AUTO_DELETE}|[true or false]</code></div><br/><div>When enabled, any durations or GM durations that reach a length of 0 or less will automatically be deleted. Public durations in the turnorder are deleted when the turnorder is advanced and the duration is last in the turnorder. GM durations are deleted at the start of each round.</div><br/><div>When calling this command, lettercase must be retained for the <code>${AUTO_DELETE}</code> config setting in the command call.</div>`,
    });

    return `<table style="border: 2px solid gray;">${tableHeader}<tbody>${addDurationCells}${addGMDurationCells}${showGMDurationsCells}${clearDurationsCells}${sortDurationsCells}${roundNameCells}${autoClearCells}${autoDeleteCells}</tbody></table>`;
  }

  function handleChatInput(message) {
    try {
      const {
        ADD_DURATION,
        ADD_GM_DURATION,
        SHOW_GM_DURATIONS,
        DELETE_GM_DURATION,
        CLEAR,
        CLEAR_TURNORDER,
        SORT,
        SORT_TURNORDER,
        CONFIG,
      } = COMMANDS;

      const [prefix, ...options] = message.content.split("|");
      const command = prefix.split(" ")[1].toLowerCase();

      switch (command) {
        case ADD_DURATION:
          addDuration(...options);
          break;
        case ADD_GM_DURATION:
          addGMDuration(...options);
          break;
        case SHOW_GM_DURATIONS:
          showGMDurations(state.Durations.gmDurations);
          break;
        case DELETE_GM_DURATION:
          deleteGMDuration(parseInt(options[0]));
          break;
        case CLEAR:
        case CLEAR_TURNORDER:
          clearTurnorder();
          break;
        case SORT:
        case SORT_TURNORDER:
          const turnorder = getTurnorder();
          const sortedTurnorder = sortTurnorder(turnorder, ...options);
          setTurnOrder(sortedTurnorder);
          break;
        case CONFIG:
          log("setting");
          log(options[0]);
          log("value");
          log(options[1]);
          if (options.length) {
            state.Durations[options[0]] =
              options[0] === CONFIG_SETTINGS.ROUND_DISPLAY_NAME
                ? options[1]
                : options[1].toLowerCase() === "true";
          }

          sendMessage(buildConfigDisplay());
          break;
      }
    } catch (error) {
      sendMessage(`/w gm ${error}`);
    }
  }

  function registerEventHandlers() {
    on("chat:message", (message) => {
      if (
        playerIsGM(message.playerid) &&
        message.type === "api" &&
        /^!durations/i.test(message.content)
      ) {
        handleChatInput(message);
      }
    });

    on("change:campaign:initiativepage", () => {
      if (
        Campaign().get("initiativepage") &&
        state.Durations.autoClearTurnorder
      ) {
        clearTurnorder();
      }
    });

    on("change:campaign:turnorder", (obj, prev) => {
      const turnorder = getTurnorder();
      const prevTurnorder = JSON.parse(prev.turnorder);
      // We want to adjust the previous turnorder to check whether it is equal to the current turnorder to prevent deletions from happening on just any turnorder change. The two should only be equal by advancing the turnorder normally, and should never be equal when manually adding/deleting items from the turnorder or manually rearranging it.
      const adjustedPrevTurnorder = _.map(
        [...prevTurnorder.slice(1), prevTurnorder[0]],
        (turnItem, index) => {
          if (index === 0 && _.has(turnItem, "formula")) {
            return {
              ...turnItem,
              pr: parseFloat(turnItem.pr) + parseFloat(turnItem.formula),
            };
          }

          return turnItem;
        }
      );

      if (
        state.Durations.isTurnorderSorted &&
        _.isEqual(turnorder, adjustedPrevTurnorder)
      ) {
        const { autoDeleteDurations, gmDurations, roundDisplayName } =
          state.Durations;

        if (autoDeleteDurations) {
          const lastTurnItem = turnorder[turnorder.length - 1];

          if (
            /^\-/.test(lastTurnItem.formula) &&
            parseFloat(lastTurnItem.pr) <= 0 &&
            lastTurnItem.custom !== roundDisplayName
          ) {
            const turnorderWithoutLast = sortTurnorder(
              _.filter(
                turnorder,
                (turnItem) => !_.isEqual(turnItem, lastTurnItem)
              )
            );

            setTurnOrder(turnorderWithoutLast);
          }
        }

        if (gmDurations.length && turnorder[0].custom === roundDisplayName) {
          const updatedGMDurations = _.map(gmDurations, (durationItem) => {
            return {
              ...durationItem,
              pr:
                parseFloat(durationItem.pr) + parseFloat(durationItem.formula),
            };
          });

          showGMDurations(updatedGMDurations);

          state.Durations.gmDurations = autoDeleteDurations
            ? _.filter(
                updatedGMDurations,
                (gmDuration) => parseFloat(gmDuration.pr) > 0
              )
            : updatedGMDurations;
        }
      }
    });
  }

  function checkInstall() {
    if (!_.has(state, "Durations")) {
      log("Installing " + DURATION_DISPLAY_NAME);
      state.Durations = JSON.parse(JSON.stringify(DEFAULT_STATE));

      createMacros();
    }

    log(
      `${DURATION_DISPLAY_NAME} installed. Last updated ${new Date(
        LAST_UPDATED
      ).toLocaleDateString("en-US", {
        dateStyle: "long",
      })}.`
    );
  }

  return {
    checkInstall,
    registerEventHandlers,
  };
})();

on("ready", () => {
  "use strict";

  Durations.checkInstall();
  Durations.registerEventHandlers();
});
