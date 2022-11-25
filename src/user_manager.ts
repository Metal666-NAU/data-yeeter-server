export class UserManager {
  private users: User[] = [];
  private friendships: Friendship[] = [];

  addUser(uuid: String): User | undefined {
    if (!uuid) {
      return;
    }

    let existingUser = this.users.find((user) => user.uuid === uuid);

    if (existingUser) {
      return existingUser;
    }

    let discoveryCode: String;

    do {
      discoveryCode = this.generateDiscoveryCode(
        this.users.length.toString().length + 5
      );
    } while (
      this.users.find((user) => user.discoveryCode === discoveryCode) !==
      undefined
    );

    let user = new User(uuid, discoveryCode);

    this.users.push(user);

    return user;
  }

  removeUser(user: User | undefined): boolean {
    if (!user || !this.users.includes(user)) {
      return false;
    }

    this.users = this.users.filter((value) => value !== user);

    return true;
  }

  addFriendship(initiator: User, targetCode: String): Friendship | undefined {
    let target = this.discoverUser(targetCode);

    if (!target) {
      return undefined;
    }

    let friendship = new Friendship(initiator, target);

    this.friendships.push(friendship);

    return friendship;
  }

  findFriendship(initiator: User): Friendship | undefined {
    return this.friendships.find(
      (frienship) => frienship.initiator === initiator
    );
  }

  hasUser = (user: User | undefined): boolean =>
    user ? this.users.includes(user) : false;

  discoverUser = (discoveryCode: String): User | undefined =>
    this.users.find(
      (user) => user.discoveryCode === discoveryCode && user.visible
    );

  private generateDiscoveryCode(length: number): String {
    let result: String = "";

    for (let index = 0; index < length; index++) {
      result += Math.floor(Math.random() * 10).toString();
    }

    return result;
  }
}

declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

class User {
  readonly uuid: String;
  readonly discoveryCode: String;
  visible: boolean = false;

  constructor(uuid: String, discoveryCode: String) {
    this.uuid = uuid;
    this.discoveryCode = discoveryCode;
  }
}

class Friendship {
  readonly initiator: User;
  readonly target: User;

  targetAgreed: boolean = false;

  constructor(initiator: User, target: User) {
    this.initiator = initiator;
    this.target = target;
  }
}
