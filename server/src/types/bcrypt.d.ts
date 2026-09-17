declare module 'bcrypt' {
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  export function hash(s: string, rounds: number | string): Promise<string>;
  export function hashSync(s: string, rounds: number | string): string;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function compareSync(s: string, hash: string): boolean;
}
