export class UserManager {
  private users: User[] = [];

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
        this.users.length.toString().length + 1
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

  hasUser = (user: User | undefined): boolean =>
    user ? this.users.includes(user) : false;

  findUser = (discoveryCode: String): User | undefined =>
    this.users.find((user) => user.discoveryCode === discoveryCode);

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

  constructor(uuid: String, discoveryCode: String) {
    this.uuid = uuid;
    this.discoveryCode = discoveryCode;
  }
}
