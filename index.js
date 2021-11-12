"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeResponse = exports.sql = exports.fn = exports.Server = exports.Client = exports.Protocol = exports.Port = exports.Proxy = exports.encode = exports.decode = exports.register = exports.thisClient = exports.sendFormatted = exports.returnFormatted = exports.paginate = exports.feedback = exports.getFriendList = void 0;
const stdlib_paper_1 = require("@grakkit/stdlib-paper");
const socket_1 = require("@grakkit/socket");
Object.defineProperty(exports, "Client", { enumerable: true, get: function () { return socket_1.Client; } });
Object.defineProperty(exports, "Server", { enumerable: true, get: function () { return socket_1.Server; } });
function decode(content) {
    let index = 0;
    let string = '';
    let extra1, extra2;
    while (index < content.length) {
        let char = content[index++];
        switch (char >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                string += String.fromCharCode(char);
                break;
            case 12:
            case 13:
                extra1 = content[index++];
                string += String.fromCharCode(((char & 0x1f) << 6) | (extra1 & 0x3f));
                break;
            case 14:
                extra1 = content[index++];
                extra2 = content[index++];
                string += String.fromCharCode(((char & 0x0f) << 12) | ((extra1 & 0x3f) << 6) | ((extra2 & 0x3f) << 0));
                break;
        }
    }
    return string;
}
exports.decode = decode;
function encode(content) {
    let index = 0;
    const array = new Uint8Array(content.length);
    while (index < content.length) {
        array[index] = content.charCodeAt(index++);
    }
    return array;
}
exports.encode = encode;
let Proxy;
exports.Proxy = Proxy;
let Port;
exports.Port = Port;
let NodeType;
let NodeName;
let Driver;
let sql;
exports.sql = sql;
const insertAt = (str, sub, pos) => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
setImmediate(() => {
    if (stdlib_paper_1.manager.getPlugin('MySQL').isEnabled()) {
        //@ts-expect-error
        Driver = (0, stdlib_paper_1.type)('com.mysql.cj.jdbc.Driver');
        new Driver();
        //@ts-expect-error
        exports.sql = sql = (0, stdlib_paper_1.type)('me.vagdedes.mysql.database.MySQL');
        try {
            sql.disconnect();
        }
        catch (e) { }
        sql.connect();
        console.info(`[grakkit] §dCursed Network §f« » §3MySQL §aSUCCESS`);
    }
    else
        console.info(`[grakkit] §dCursed Network §f« » §3MySQL §cFAILURE§r! Is MySQL plugin present and enabled?`);
});
const UUID = (0, stdlib_paper_1.type)('java.util.UUID');
const thisClient = new socket_1.Client();
exports.thisClient = thisClient;
function register(type, port, name) {
    exports.Port = Port = port;
    NodeType = type;
    NodeName = name;
    switch (type) {
        case 'server': {
            exports.Proxy = Proxy = new socket_1.Server();
            Proxy.start(port);
            try {
                thisClient.connect(port);
            }
            catch (e) {
                console.error(e);
            }
            break;
        }
        case 'client': {
            try {
                thisClient.connect(port);
            }
            catch (e) {
                console.error(e);
            }
            break;
        }
    }
    console.info('[grakkit] §dCursed Network §rinit §aSUCCESS');
    console.info(`§fNode: §3${NodeType}§r §fPort: §3${Port}§r`);
    /* Register Proxy Listeners */
    Proxy.on('data', ({ client, data }) => {
        const metadata = JSON.parse(decode(data));
        const Data = metadata.params;
        const protocol = metadata.protocol;
        if (typeof protocol == 'undefined')
            return;
        switch (protocol) {
            case 'SEND_MESSAGE': {
                if (Data.uuid && typeof Data.message != 'undefined') {
                    //@ts-expect-error
                    const player = server.getOfflinePlayer(UUID.fromString(Data.uuid));
                    if (player.isOnline())
                        player.getPlayer().sendMessage(Data.message);
                }
                break;
            }
            /*case 'DISPATCH_PARTY_REQUEST': {
               if (typeof Data.sender != 'undefined' && typeof Data.target != 'undefined') {
                  ////@ts-expect-error
                  const target = server.getOfflinePlayer(UUID.fromString(Data.target));
                  if (!target.isOnline()) return;
                  ////@ts-expect-error
                  const sender = server.getOfflinePlayer(UUID.fromString(Data.sender));
                  break;
               }
            }*/
        }
    });
}
exports.register = register;
function serializeRow(response, columns) {
    const row = {};
    for (let i = 0; typeof columns[i] != 'undefined'; i++) {
        row[columns[i]] = response.getString(columns[i]);
    }
    return row;
}
function serializeResponse(response, columns) {
    const arrResponse = [];
    let i = 0;
    if (response == null)
        return [];
    if (!response.next())
        return [];
    for (let result = true; result; result = response.next()) {
        arrResponse[i++] = serializeRow(response, columns);
    }
    return arrResponse;
}
exports.serializeResponse = serializeResponse;
function justify(...array) {
    return array.join(' ');
}
const fn = {
    getPendingRequestsSent(friender_id) {
        return serializeResponse(sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE '${friender_id}' IN (friender_id) AND friend.id <> '${friender_id}'`, `AND accepted_at IS null AND blocked_at IS null;`)), ['friendee_id', 'created_at']);
    },
    getPendingRequestsReceived(friendee_id) {
        return serializeResponse(sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id`, `WHERE friendee_id = '${friendee_id}'`, `AND accepted_at IS null and blocked_at IS null`)), ['friender_id', 'created_at']);
    },
    sendMessage(id, message) {
        Protocol('SEND_MESSAGE', { uuid: id, message: message });
    },
    getFriends(id) {
        return serializeResponse(sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE '${id}' IN (friendee_id, friender_id) AND friend.id <> '${id}'`, `AND accepted_at IS NOT null AND blocked_at IS null;`)), ['id', 'name', 'created_at', 'accepted_at']);
    },
    removeFriend(friender_id, friendee_id) {
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        // if friends
        const q = sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND accepted_at IS NOT null`));
        if (q != null && q.next() && q.getString('accepted_at') != null) {
            // remove friend
            return sql.update(justify(`DELETE FROM friendships`, `WHERE friender_id = '${friender_id}' AND friendee_id = '${friendee_id}' OR friender_id = '${friendee_id}' AND friendee_id = '${friender_id}'`));
        }
        else
            return 'NOT_FRIENDS';
    },
    userExists(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (q != null && q.next() && q.getString('id') != null)
            return true;
        return false;
    },
    declineRequest(friender_id, friendee_id) {
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        const q = sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND accepted_at IS null AND blocked_at IS null;`));
        if (q != null && q.next())
            return sql.update(justify(`DELETE FROM friendships`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND accepted_at IS null;`));
        else
            return false;
    },
    addFriend(friender_id, friendee_id) {
        /* If a friend request exists */
        if (!fn.userExists(friender_id))
            return 'FRIENDER_ID_INVALID';
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        const q = sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS null;`);
        if (q != null && q.next())
            if (!sql.update(justify('UPDATE friendships', 'SET accepted_at = now()', `WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}'`, `AND accepted_at IS null`)))
                /* add as a friend */
                return sql.update(justify('UPDATE friendships', 'SET accepted_at = now()', `WHERE friendee_id = '${friender_id}' AND friender_id = '${friendee_id}'`, `AND accepted_at IS null`));
            else
                return true;
        else {
            const q2 = sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS NOT null;`);
            if (q2 != null && q2.next())
                return 'ALREADY_FRIEND';
            else
                return 'REQUEST_NOT_ACTIVE';
        }
    },
    test(friender_id, friendee_id) {
        return sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND accepted_at IS null AND blocked_at IS null`));
    },
    // send friend request from friender_id to friendee_id
    // use sql
    // if user doesn't exist return 'FRIENDEE_ID_INVALID'
    // if friend request already exists return 'REQUEST_ALREADY_EXISTS'
    // if friendee_id already sent a friend request to friender_id, automatically accept the request
    // if friendee_id is already a friend with friender_id, return 'ALREADY_FRIEND'
    // if friendee_id is blocked by friender_id, return 'FRIENDEE_BLOCKED'
    sendFriendRequest(friender_id, friendee_id) {
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        const q = sql.query(justify(`SELECT * FROM friendships`, `WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}' AND accepted_at IS null;`));
        if (q != null && q.next())
            return 'REQUEST_ALREADY_EXISTS';
        const q2 = sql.query(justify(`SELECT * FROM friendships`, `WHERE friendee_id = '${friender_id}' AND friender_id = '${friendee_id}' AND accepted_at IS null;`));
        if (q2 != null && q2.next()) {
            fn.addFriend(friendee_id, friender_id);
            return 'AUTO_ACCEPTED';
        }
        const q3 = sql.query(justify(`SELECT * FROM friendships`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND accepted_at IS NOT null;`));
        if (q3 != null && q3.next())
            return 'ALREADY_FRIEND';
        const q4 = sql.query(justify(`SELECT * FROM friendships`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND blocked_at IS NOT null;`));
        if (q4 != null && q4.next())
            return 'FRIENDEE_BLOCKED';
        sql.update(justify(`INSERT INTO friendships`, `(friender_id, friendee_id, created_at)`, `VALUES`, `('${friender_id}', '${friendee_id}', now())`));
        return 'REQUEST_SENT';
        // if the friendee_id sent a friend request to friender_id, automatically accept the request
    },
    sendFriendRequestBackup(friender_id, friendee_id) {
        /* If a friend request exists */
        if (!fn.userExists(friendee_id))
            return 'FRIENDEE_ID_INVALID';
        const q = sql.query(justify(`SELECT * FROM users AS \`friend\``, `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`, `WHERE`, `('${friender_id}' in (friender_id) OR`, `'${friendee_id}' in (friender_id))`, `AND ('${friendee_id}' in (friendee_id)`, `OR '${friender_id}' in (friendee_id))`, `AND accepted_at IS null AND blocked_at IS null`));
        if (q != null && q.next()) {
            switch (q.getString('friender_id')) {
                case friender_id:
                    return 'ALREADY_SENT';
                case friendee_id: {
                    fn.addFriend(friendee_id, friender_id);
                    return 'AUTO_ACCEPTED';
                }
            }
        }
        else {
            const q2 = sql.query(`SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`);
            if (q2 != null && q2.next())
                return 'ALREADY_FRIEND';
            else
                return sql.update(justify(`INSERT INTO friendships (friender_id, friendee_id) VALUES ('${friender_id}', '${friendee_id}');`));
        }
    },
    getNameFromUuid(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}';`);
        const empty = !q.next();
        if (q != null && !empty && q.getString('name') != null)
            return q.getString('name');
        const name = (0, stdlib_paper_1.fetch)(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`).json().name;
        if (empty && q.getString('id') == null)
            sql.update(`INSERT INTO users (id, name, server) VALUES ('${id}', '${name}', '${NodeName}')`);
        else
            sql.update(`UPDATE users SET name = '${name}' WHERE id = '${id}';`);
        return name;
    },
    getUuidFromName(name) {
        const request = (0, stdlib_paper_1.fetch)(`https://api.mojang.com/users/profiles/minecraft/${name}`);
        try {
            let id = request.json().id;
            id = insertAt(id, '-', 8);
            id = insertAt(id, '-', 13);
            id = insertAt(id, '-', 18);
            id = insertAt(id, '-', 23);
            return id;
        }
        catch (e) {
            return null;
        }
    },
    hasFriends(id) {
        const q = sql.query(justify(`SELECT * FROM friendships WHERE friendee_id = '${id}' OR friender_id = '${id}' AND accepted_at IS NOT null;`));
        if (q != null && q.next())
            return true;
        else
            return false;
    },
    addUser(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (q != null && q.next() && q.getString('id') != null)
            return 'ALREADY_EXISTS';
        return sql.update(`INSERT INTO users (id, name, server) VALUES ('${id}', '${(0, stdlib_paper_1.fetch)(`https://sessionserver.mojang.com/session/minecraft/profile/` + id).json().name}', '${NodeName}');`);
    },
    getServer(id) {
        const q = sql.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (q != null && q.next() && q.getString('server') != null)
            return q.getString('server');
        return null;
    },
    setServer(id, server) {
        return sql.update(`UPDATE users SET server = '${server}' WHERE id = '${id}'`);
    }
};
exports.fn = fn;
function Protocol(protocol, params) {
    thisClient.send(encode(JSON.stringify({ protocol: protocol, params })));
}
exports.Protocol = Protocol;
function filter(suggestions, key) {
    return suggestions.filter(word => {
        return word.toLowerCase().includes(key.toLowerCase());
    });
}
function getFriendList(player) {
    const friends = fn.getFriends(player.getUniqueId().toString());
    if (friends.length === 0)
        return [];
    const names = [];
    let i = names.length;
    friends.forEach(friend => {
        //@ts-expect-error
        if (friend.name != null)
            names[i] = friend.name;
        else {
            //@ts-expect-error
            const q = sql.query(`SELECT * FROM users WHERE id = '${friend.id}';`);
            if (q != null && q.next() && q.getString('name') != null)
                names[i] = q.getString('name');
            else {
                names[i] = (0, stdlib_paper_1.fetch)(`https://sessionserver.mojang.com/session/minecraft/profile/${q.getString('id')}`).json().name;
                //@ts-expect-error
                sql.update(`UPDATE users SET name = '${names[i]}' WHERE id = '${friend.id}';`);
            }
        }
        i++;
    });
    return names;
}
exports.getFriendList = getFriendList;
exports.feedback = {
    friends: {
        // return an an array of messages showing the user all the pending requests they have (make it pretty)
        getPending: (name, Requests) => {
            let requests = [];
            Requests.forEach(request => {
                requests[requests.length] = fn.getNameFromUuid(request);
            });
            if (requests.length === 1)
                return [
                    `§f${requests[0]} §bhas requested to be your friend!`,
                    '§5§m                         ',
                    `To accept, type /friend accept [name]`,
                    `To deny, type /friend deny [name]`
                ];
            if (requests.length > 4) {
                return [
                    `§bYou have §f${requests.length} §bpending §bfriend requests!`,
                    '§5§m                         ',
                    `§f${requests.slice(0, 4).join('§b,§f ')}`,
                    ` §r §r §d§o+ ${requests.length - 4} more`,
                    '§5§m                         ',
                    `§7To §aaccept§7, type §e/friend accept §d[name]`,
                    `§7To §cdeny§7, type §e/friend deny §d[name]`,
                    `§7To view all requests, type §e/friend pending`
                ];
            }
            if (requests.length > 1) {
                return [
                    `§bYou have §f${requests.length} §bpending friend requests!`,
                    '§5§m                         ',
                    `§f${requests.join('§b,§f ')}`,
                    '§5§m                         ',
                    `§7Respond with §3/friend §8<§3accept§7 | §3deny§8> §d[name]`
                ];
            }
            return null;
        },
        friendee_blocked: '§cYou are blocked by this player.',
        help: {
            header: ['§fHelp for §b/friend', '§5§m                         '],
            body: [
                '§3/f add §d[name]\n§8-> §7Send a friend request.',
                '§3/f remove §d[name]\n§8-> §7Unfriend a player.',
                '§3/f list\n§8-> §7View all your friends',
                '§3/f accept §d[name]\n§8-> §7Accept a friend request',
                '§3/f deny §d[name]\n§8-> §7Decline a friend request',
                '§3/f help §d[page]\n§8-> §7Show this dialogue'
            ]
        },
        list: {
            header(player) {
                const friends = getFriendList(player).length;
                if (friends === 0)
                    return ['§fYou have no friends'];
                return [`§fFriends (${friends}):`, '§5§m                         '];
            }
        },
        already_friend: 'You are already friends with this player!',
        friendee_id_invalid: 'This user does not exist!',
        already_sent: "You've already sent a friend request to this player!",
        not_friends: "You're already not friends with this player!",
        request_not_active: "You haven't received a friend request from this player!",
        declined_request: 'Friend request declined!',
        auto_success: name => {
            return `${name} already had an active friend request so they were automatically friended.`;
        },
        friended_success: name => {
            return `You're now friends with ${name}!`;
        },
        request_sent: name => {
            return 'A friend request has been sent to ' + name + '!';
        },
        remove_success: name => {
            return `${name} has been removed from your friends list.`;
        }
    }
};
// a function where plugging in an array and a page number will return at most 10 items a page, plugging in a page number will return those
// if array.slice(start, end) is empty, return array.slice(start)
function paginate(array, page, max = 10) {
    const start = (page - 1) * max;
    const end = page * max;
    if (array.slice(start, end).length === 0)
        return array.slice(start);
    return array.slice(start, end);
}
exports.paginate = paginate;
// a function that returns the help header, an array of friends plugged into paginate, and a footer
// if page is less than 1, return the first page
function returnFormatted(options = {
    player: null,
    args: null,
    header: [],
    body: [],
    topfooter: [],
    page: 1,
    max: 10,
    enable_pages: false
}) {
    const { player, args, header, body, topfooter, page, max, enable_pages } = options;
    if (enable_pages) {
        let Page = page;
        if (Page < 1)
            Page = 1;
        if (page > Math.ceil(body.length / max))
            Page = Math.ceil(body.length / max);
        let footer = [];
        footer = [' \n§7Page ' + Page + ' of ' + Math.ceil(body.length / max)];
        return [header, paginate(body, Page, max), topfooter, footer];
    }
    return [header, body, topfooter];
}
exports.returnFormatted = returnFormatted;
function sendFormatted(options = {
    player: null,
    args: null,
    header: [],
    body: [],
    topfooter: [],
    page: 1,
    max: 10,
    enable_pages: false
}) {
    const { player, args, header, body, topfooter, page, max, enable_pages } = options;
    let Page = 1;
    if (args && args[1])
        Page = parseInt(args[1]);
    returnFormatted({
        player: player,
        args: args,
        header: header,
        body: body,
        topfooter: topfooter,
        page: Page,
        max: max,
        enable_pages: enable_pages
    }).forEach(section => {
        if (section)
            section.forEach(line => {
                player.sendMessage(line);
            });
    });
}
exports.sendFormatted = sendFormatted;
(0, stdlib_paper_1.command)({
    name: 'friend',
    aliases: ['f', 'friends'],
    execute(player, ...args) {
        //@ts-expect-error
        const uuid = player.getUniqueId().toString();
        switch (args[0]) {
            case 'help': {
                let page = 1;
                if (args[1])
                    page = parseInt(args[1]);
                sendFormatted({
                    player: player,
                    args: args,
                    header: exports.feedback.friends.help.header,
                    body: exports.feedback.friends.help.body,
                    page: page,
                    max: 3,
                    enable_pages: true
                });
                break;
            }
            case 'list': {
                let page = 1;
                if (args[1])
                    page = parseInt(args[1]);
                sendFormatted({
                    player: player,
                    header: exports.feedback.friends.list.header(player),
                    body: getFriendList(player),
                    topfooter: ['§5§m                         '],
                    page: page,
                    max: 10,
                    enable_pages: fn.hasFriends(uuid)
                });
                break;
            }
            case 'add': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.sendFriendRequest(uuid, fn.getUuidFromName(args[1]))) {
                    case 'ALREADY_FRIEND':
                        return player.sendMessage(exports.feedback.friends.already_friend);
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(exports.feedback.friends.friendee_id_invalid);
                    case 'REQUEST_ALREADY_EXISTS':
                        return player.sendMessage(exports.feedback.friends.already_sent);
                    case 'AUTO_ACCEPTED':
                        return player.sendMessage(exports.feedback.friends.auto_success(args[1]));
                    case 'FRIENDEE_BLOCKED':
                        return player.sendMessage(exports.feedback.friends.friendee_blocked);
                    case 'REQUEST_SENT':
                        return player.sendMessage(exports.feedback.friends.request_sent(args[1]));
                    default:
                        return player.sendMessage('fuck');
                }
                break;
            }
            case 'remove': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.removeFriend(uuid, fn.getUuidFromName(args[1]))) {
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(exports.feedback.friends.friendee_id_invalid);
                    case 'NOT_FRIENDS':
                        return player.sendMessage(exports.feedback.friends.not_friends);
                    case true:
                        return player.sendMessage(exports.feedback.friends.remove_success(args[1]));
                    default:
                        return player.sendMessage('fuck');
                }
            }
            case 'deny': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.declineRequest(uuid, fn.getUuidFromName(args[1]))) {
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(exports.feedback.friends.friendee_id_invalid);
                    case true:
                        return player.sendMessage(exports.feedback.friends.declined_request);
                }
            }
            case 'accept': {
                if (typeof args[1] == 'undefined')
                    return;
                switch (fn.addFriend(fn.getUuidFromName(args[1]), uuid)) {
                    case 'ALREADY_FRIEND':
                        return player.sendMessage(exports.feedback.friends.already_friend);
                    case 'FRIENDEE_ID_INVALID':
                        return player.sendMessage(exports.feedback.friends.friendee_id_invalid);
                    case 'REQUEST_NOT_ACTIVE':
                        return player.sendMessage(exports.feedback.friends.request_not_active);
                    case true:
                        return player.sendMessage(exports.feedback.friends.friended_success(args[1]));
                }
            }
            default: {
                let page = 1;
                if (args[1])
                    page = parseInt(args[1]);
                sendFormatted({
                    player: player,
                    args: args,
                    header: exports.feedback.friends.help.header,
                    body: exports.feedback.friends.help.body,
                    page: page,
                    max: 3,
                    enable_pages: true
                });
                break;
            }
        }
    },
    tabComplete: (player, ...args) => {
        switch (args.length) {
            case 1:
                return filter(['list', 'add', 'remove', 'accept', 'deny', 'help', 'toggle'], args[0]);
        }
    }
});
(0, stdlib_paper_1.event)('org.bukkit.event.player.PlayerJoinEvent', {
    priority: 'MONITOR',
    script: event => {
        const player = event.getPlayer();
        const id = event.getPlayer().getUniqueId().toString();
        if (!fn.userExists(id))
            return fn.addUser(id);
        const requests = fn.getPendingRequestsReceived(id);
        if (requests.length === 0)
            return;
        core.task.timeout(() => {
            //@ts-expect-error
            player.sendMessage(' ');
            sendFormatted({
                player: player,
                header: exports.feedback.friends.getPending(player.getName(), 
                //@ts-expect-error
                requests.map(request => request.friender_id))
            });
        }, 2);
    }
});
