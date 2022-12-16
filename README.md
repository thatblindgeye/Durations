# Durations

Thank you for installing Durations! To suggest features or to report bugs, please create an issue at my [Durations repo](https://github.com/thatblindgeye/Durations).

The purpose of this script is to allow creating custom durations that occur during combat that last for a certain number of rounds, as well as sorting the turnorder and keeping track of the number of rounds that have elapsed.

## Commands

The following list of commands are available for use, and provide the basic syntax as well as a description of what the command does/is used for. Macros for the add-duration, add-gmduration, show-gmduration, clear, and sort commands will also be created when installing the script.

### Add duration

`!durations add-duration|[duration name]|[duration length]|[insert at initiative]`
e.g. `!durations add-duration|Bless|10|12`

Will add a duration to the Roll20 turnorder when it is active. This can be viewed by all players currently in the campaign.

The `duration length` argument must be an integer, and determines how many rounds the duration will last for. The length will display in the Roll20 turnorder as it's "initiative", and will decrement by 1 each time its turn is reached.

The `insert at initiative` argument can be an integer or decimal, and determines where in the turnorder it is placed relative to other items already in the turnorder. The default value for this argument is `0`.

The name of duration that is added to the turnorder will combine the `duration name` and `insert at initiative` arguments. For example, `!durations add-duration|Bless|10|12` will add "Bless (12)" to the turnorder.

### Add GM duration

`!durations add-gmduration|[duration name/description]|[duration length]`
e.g. `!durations add-gmduration|The goblins attack|10`

Adds a private duration only available to the GM. GM durations are not placed in the Roll20 turnorder, but rather stored in the Durations state object.

GM durations can act as reminders to the GM for events that will occur after a certain number of rounds, or effects that only the GM should know about.

At the start of each round, or when the `show-gmduration` command is called, GM durations will be sent in chat as a whisper to the GM. Each GM duration will include a button to delete that duration.

The `duration length` argument must be an integer, and will decrement by 1 at the start of each round.

### Show GM duration

`!durations show-gmduration`

Sends the current GM durations to chat as a whisper to the GM.

### Clear turnorder

`!durations clear`

Clears all items in the Roll20 turnorder.

### Sort turnorder

`!durations sort|[starting round]|[round formula]|[sort order]`
e.g. `!durations sort|5|+1|ascending`

Sorts the turnorder in the specified order. If the turnorder has not yet been sorted, an item to track the number of rounds will be added. If the turnorder has already been sorted, sorting it again will retain the current turn item.

The `starting round` argument must be an integer, and determines what round the turnorder will start on. By default the starting round is `1`.

The `round formula` argument must be either a plus sign `+` or minus sign `-` followed by an integer. This determines how the round number will update. By default the round formula is `+1`.

The `sort order` argument must be either `ascending` or `descending`, and determines how the turnorder is sorted. "Ascending" will place the items with a lower initiative first, while "descending" will place items with a higher initiative first. The default sort order is `descending`.

### Round display name

`!durations config|roundDisplayName|[new display name]`
e.g. `!durations config|roundDisplayName|ROUND`

This will update the turnorder item that is added for tracking the current round when the turnorder is sorted. The default display name is `<= Round =>`.

### Auto-clear turnorder

`!durations config|autoClearTurnorder|[true or false]`
e.g. `!durations config|autoClearTurnorder|false`

Determines whether the turnorder is automatically cleared anytime it is closed. By default this setting is `true`.

Note: keeping the turnorder open and closing the Roll20 tab shouldn't cause the turnorder to autoclear. The autoclear setting should only trigger when closing the turnorder itself.

### Auto-delete durations

`!durations config|autoDeleteDurations|[true or false]`
e.g. `!durations config|autoDeleteDurations|false`

Determines whether duration or GM duration items that reach a length of 0 are automatically deleted or not. By default this setting is `true`.
