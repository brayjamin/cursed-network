import { type, command } from '@grakkit/stdlib-paper';
import { Client, Server } from '@grakkit/socket';
function decode (content: Uint8Array) {
   let index = 0;
   let string = '';
   let extra1: number, extra2: number;
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
function encode (content: string) {
   let index = 0;
   const array = new Uint8Array(content.length);
   while (index < content.length) {
      array[index] = content.charCodeAt(index++);
   }
   return array;
}

//@ts-expect-error
const Driver = type('com.mysql.cj.jdbc.Driver');
//@ts-expect-error
new Driver();
//@ts-expect-error
const sql = type('me.vagdedes.mysql.database.MySQL');
try {
   //@ts-expect-error
   sql.disconnect();
} catch (e) {}
//@ts-expect-error
sql.connect();
type Proxy = Server;
let Proxy: Proxy;
let Port;
let NodeType;
const UUID = type('java.util.UUID');
const thisClient = new Client();
type NodeType = 'server' | 'client';
function register (type: NodeType, port: number) {
   Port = port;
   NodeType = type;
   switch (type) {
      case 'server': {
         Proxy = new Server();
         Proxy.start(port);
         try {
            thisClient.connect(port);
         } catch (e) {
            console.error(e);
         }
         break;
      }
      case 'client': {
         try {
            thisClient.connect(port);
         } catch (e) {
            console.error(e);
         }
         break;
      }
   }
   /* Register Proxy Listeners */
   Proxy.on('data', ({ client, data }) => {
      const metadata = JSON.parse(decode(data));
      const Data = metadata.params;
      const protocol = metadata.protocol;
      if (typeof protocol == 'undefined') return;
      switch (protocol) {
         case 'SEND_MESSAGE': {
            if (typeof Data.uuid != 'undefined' && typeof Data.message != 'undefined') {
               //@ts-expect-error
               const player = server.getOfflinePlayer(UUID.fromString(Data.uuid));
               if (player.isOnline()) player.getPlayer().sendMessage(Data.message);
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
function serializeRow (response, columns) {
   const row = {};
   for (let i = 0; typeof columns[i] != 'undefined'; i++) {
      row[columns[i]] = response.getString(columns[i]);
   }
   return row;
}
function serializeResponse (response: any, columns: any) {
   const arrResponse = [];
   let i = 0;
   if (response == null) return [];
   if (!response.next()) return [];
   for (let result = true; result; result = response.next()) {
      arrResponse[i++] = serializeRow(response, columns);
   }
   return arrResponse;
}
function justify (...array: string[]) {
   return array.join(' ');
}
const fn = {
   getPendingRequestsSent (friender_id: string) {
      return serializeResponse(
         //@ts-expect-error
         sql.query(
            justify(
               `SELECT * FROM users AS \`friend\``,
               `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
               `WHERE '${friender_id}' IN (friender_id) AND friend.id <> '${friender_id}'`,
               `AND accepted_at IS null AND blocked_at IS null;`
            )
         ),
         [ 'friendee_id', 'created_at' ]
      );
   },
   getPendingRequestsReceived (friendee_id: string) {
      return serializeResponse(
         //@ts-expect-error
         sql.query(
            justify(
               `SELECT * FROM users AS \`friend\``,
               `JOIN friendships ON friender_id = friend.id`,
               `WHERE friendee_id = '${friendee_id}'`,
               `AND accepted_at IS null and blocked_at IS null`
            )
         ),
         [ 'friender_id', 'created_at' ]
      );
   },
   getFriends (id: string) {
      return serializeResponse(
         //@ts-expect-error
         sql.query(
            justify(
               `SELECT * FROM users AS \`friend\``,
               `JOIN friendships ON friender_id = friend.id OR friendee_id = friend.id`,
               `WHERE '${id}' IN (friendee_id, friender_id) AND friend.id <> '${id}'`,
               `AND accepted_at IS NOT null AND blocked_at IS null;`
            )
         ),
         [ 'id', 'created_at', 'accepted_at' ]
      );
   },
   removeFriend (friender_id, friendee_id) {
      // if friends
      if (
         sql
            //@ts-expect-error
            .query(
               `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`
            ) == null
      ) {
         // remove friend
         //@ts-expect-error
         return sql.update(
            justify(
               'UPDATE friendships',
               'SET accepted_at = NULL',
               `WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}'`,
               `AND accepted_at IS NOT null;`
            )
         );
      } else return 'not friends';
   },
   addFriend (friender_id, friendee_id) {
      /* If a friend request exists */
      if (
         //@ts-expect-error
         sql.query(
            `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS null;`
         ) != null &&
         sql
            //@ts-expect-error
            .query(
               `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS null;`
            )
            .next()
      )
         if (
            //@ts-expect-error
            !sql.update(
               justify(
                  'UPDATE friendships',
                  'SET accepted_at = now()',
                  `WHERE friendee_id = '${friendee_id}' AND friender_id = '${friender_id}'`,
                  `AND accepted_at IS null`
               )
            )
         )
            /* add as a friend */
            //@ts-expect-error
            return sql.update(
               justify(
                  'UPDATE friendships',
                  'SET accepted_at = now()',
                  `WHERE friendee_id = '${friender_id}' AND friender_id = '${friendee_id}'`,
                  `AND accepted_at IS null`
               )
            );
         else return true;
      else if (
         //@ts-expect-error
         sql.query(
            `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`
         ) != null &&
         sql
            //@ts-expect-error
            .query(
               `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`
            )
            .next()
      )
         /* if already friends */
         return 'already friends';
      else return 'no active friend request';
   },
   sendFriendRequest (friender_id, friendee_id) {
      /* If a friend request exists */
      if (
         //@ts-expect-error
         sql.query(
            `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS null;`
         ) != null &&
         sql
            //@ts-expect-error
            .query(
               `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS null;`
            )
            .next()
      )
         return 'already sent';
      else if (
         //@ts-expect-error
         sql.query(
            `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`
         ) != null &&
         sql
            //@ts-expect-error
            .query(
               `SELECT * FROM friendships WHERE friendee_id = '${friendee_id}' OR friendee_id = '${friender_id}' AND friender_id = '${friender_id}' OR friender_id = '${friendee_id}' AND accepted_at IS NOT null;`
            )
            .next()
      )
         return 'already friends';
      else
         //@ts-expect-error
         return sql.update(
            justify(`INSERT INTO friendships (friender_id, friendee_id) VALUES ('${friender_id}', '${friendee_id}');`)
         );
   }
};
function Protocol (protocol: string, params: {}) {
   thisClient.send(encode(JSON.stringify({ protocol: protocol, params })));
}
command({
   name: 'friends',
   execute (player) {
      //@ts-expect-error
      const uuid = player.getUniqueId().toString();
      fn.getFriends(uuid);
   }
});
export {
   thisClient,
   register,
   decode,
   encode,
   Proxy,
   Port,
   Protocol,
   Client,
   Server,
   fn,
   sql,
   serializeResponse as decodeResponse
};
