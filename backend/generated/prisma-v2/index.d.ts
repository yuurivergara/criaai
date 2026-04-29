
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * Application user (e-mail + password). Owns Pages, Jobs and CustomDomains.
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Job
 * 
 */
export type Job = $Result.DefaultSelection<Prisma.$JobPayload>
/**
 * Model Page
 * 
 */
export type Page = $Result.DefaultSelection<Prisma.$PagePayload>
/**
 * Model PageVersion
 * 
 */
export type PageVersion = $Result.DefaultSelection<Prisma.$PageVersionPayload>
/**
 * Model CustomDomain
 * Custom domain (e.g. "quiz.minhamarca.com") attached to a published Page.
 * The middleware uses `host` to route incoming requests to the matching
 * page bundle. Verification is done via a one-time TXT record so we know
 * the user actually owns the domain before serving content under it.
 */
export type CustomDomain = $Result.DefaultSelection<Prisma.$CustomDomainPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.job`: Exposes CRUD operations for the **Job** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Jobs
    * const jobs = await prisma.job.findMany()
    * ```
    */
  get job(): Prisma.JobDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.page`: Exposes CRUD operations for the **Page** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Pages
    * const pages = await prisma.page.findMany()
    * ```
    */
  get page(): Prisma.PageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.pageVersion`: Exposes CRUD operations for the **PageVersion** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PageVersions
    * const pageVersions = await prisma.pageVersion.findMany()
    * ```
    */
  get pageVersion(): Prisma.PageVersionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customDomain`: Exposes CRUD operations for the **CustomDomain** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CustomDomains
    * const customDomains = await prisma.customDomain.findMany()
    * ```
    */
  get customDomain(): Prisma.CustomDomainDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Job: 'Job',
    Page: 'Page',
    PageVersion: 'PageVersion',
    CustomDomain: 'CustomDomain'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "job" | "page" | "pageVersion" | "customDomain"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Job: {
        payload: Prisma.$JobPayload<ExtArgs>
        fields: Prisma.JobFieldRefs
        operations: {
          findUnique: {
            args: Prisma.JobFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.JobFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>
          }
          findFirst: {
            args: Prisma.JobFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.JobFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>
          }
          findMany: {
            args: Prisma.JobFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>[]
          }
          create: {
            args: Prisma.JobCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>
          }
          createMany: {
            args: Prisma.JobCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.JobCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>[]
          }
          delete: {
            args: Prisma.JobDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>
          }
          update: {
            args: Prisma.JobUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>
          }
          deleteMany: {
            args: Prisma.JobDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.JobUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.JobUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>[]
          }
          upsert: {
            args: Prisma.JobUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$JobPayload>
          }
          aggregate: {
            args: Prisma.JobAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateJob>
          }
          groupBy: {
            args: Prisma.JobGroupByArgs<ExtArgs>
            result: $Utils.Optional<JobGroupByOutputType>[]
          }
          count: {
            args: Prisma.JobCountArgs<ExtArgs>
            result: $Utils.Optional<JobCountAggregateOutputType> | number
          }
        }
      }
      Page: {
        payload: Prisma.$PagePayload<ExtArgs>
        fields: Prisma.PageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>
          }
          findFirst: {
            args: Prisma.PageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>
          }
          findMany: {
            args: Prisma.PageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>[]
          }
          create: {
            args: Prisma.PageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>
          }
          createMany: {
            args: Prisma.PageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>[]
          }
          delete: {
            args: Prisma.PageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>
          }
          update: {
            args: Prisma.PageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>
          }
          deleteMany: {
            args: Prisma.PageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>[]
          }
          upsert: {
            args: Prisma.PageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PagePayload>
          }
          aggregate: {
            args: Prisma.PageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePage>
          }
          groupBy: {
            args: Prisma.PageGroupByArgs<ExtArgs>
            result: $Utils.Optional<PageGroupByOutputType>[]
          }
          count: {
            args: Prisma.PageCountArgs<ExtArgs>
            result: $Utils.Optional<PageCountAggregateOutputType> | number
          }
        }
      }
      PageVersion: {
        payload: Prisma.$PageVersionPayload<ExtArgs>
        fields: Prisma.PageVersionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PageVersionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PageVersionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>
          }
          findFirst: {
            args: Prisma.PageVersionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PageVersionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>
          }
          findMany: {
            args: Prisma.PageVersionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>[]
          }
          create: {
            args: Prisma.PageVersionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>
          }
          createMany: {
            args: Prisma.PageVersionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PageVersionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>[]
          }
          delete: {
            args: Prisma.PageVersionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>
          }
          update: {
            args: Prisma.PageVersionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>
          }
          deleteMany: {
            args: Prisma.PageVersionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PageVersionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PageVersionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>[]
          }
          upsert: {
            args: Prisma.PageVersionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PageVersionPayload>
          }
          aggregate: {
            args: Prisma.PageVersionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePageVersion>
          }
          groupBy: {
            args: Prisma.PageVersionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PageVersionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PageVersionCountArgs<ExtArgs>
            result: $Utils.Optional<PageVersionCountAggregateOutputType> | number
          }
        }
      }
      CustomDomain: {
        payload: Prisma.$CustomDomainPayload<ExtArgs>
        fields: Prisma.CustomDomainFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomDomainFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomDomainFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>
          }
          findFirst: {
            args: Prisma.CustomDomainFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomDomainFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>
          }
          findMany: {
            args: Prisma.CustomDomainFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>[]
          }
          create: {
            args: Prisma.CustomDomainCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>
          }
          createMany: {
            args: Prisma.CustomDomainCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomDomainCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>[]
          }
          delete: {
            args: Prisma.CustomDomainDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>
          }
          update: {
            args: Prisma.CustomDomainUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>
          }
          deleteMany: {
            args: Prisma.CustomDomainDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomDomainUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CustomDomainUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>[]
          }
          upsert: {
            args: Prisma.CustomDomainUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomDomainPayload>
          }
          aggregate: {
            args: Prisma.CustomDomainAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomDomain>
          }
          groupBy: {
            args: Prisma.CustomDomainGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomDomainGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomDomainCountArgs<ExtArgs>
            result: $Utils.Optional<CustomDomainCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    job?: JobOmit
    page?: PageOmit
    pageVersion?: PageVersionOmit
    customDomain?: CustomDomainOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    passwordHash: number
    name: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    passwordHash: string
    name: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "passwordHash" | "name" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      passwordHash: string
      name: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly passwordHash: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
  }


  /**
   * Model Job
   */

  export type AggregateJob = {
    _count: JobCountAggregateOutputType | null
    _min: JobMinAggregateOutputType | null
    _max: JobMaxAggregateOutputType | null
  }

  export type JobMinAggregateOutputType = {
    id: string | null
    type: string | null
    status: string | null
    error: string | null
    userId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type JobMaxAggregateOutputType = {
    id: string | null
    type: string | null
    status: string | null
    error: string | null
    userId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type JobCountAggregateOutputType = {
    id: number
    type: number
    status: number
    payload: number
    result: number
    error: number
    userId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type JobMinAggregateInputType = {
    id?: true
    type?: true
    status?: true
    error?: true
    userId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type JobMaxAggregateInputType = {
    id?: true
    type?: true
    status?: true
    error?: true
    userId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type JobCountAggregateInputType = {
    id?: true
    type?: true
    status?: true
    payload?: true
    result?: true
    error?: true
    userId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type JobAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Job to aggregate.
     */
    where?: JobWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Jobs to fetch.
     */
    orderBy?: JobOrderByWithRelationInput | JobOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: JobWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Jobs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Jobs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Jobs
    **/
    _count?: true | JobCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: JobMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: JobMaxAggregateInputType
  }

  export type GetJobAggregateType<T extends JobAggregateArgs> = {
        [P in keyof T & keyof AggregateJob]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateJob[P]>
      : GetScalarType<T[P], AggregateJob[P]>
  }




  export type JobGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: JobWhereInput
    orderBy?: JobOrderByWithAggregationInput | JobOrderByWithAggregationInput[]
    by: JobScalarFieldEnum[] | JobScalarFieldEnum
    having?: JobScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: JobCountAggregateInputType | true
    _min?: JobMinAggregateInputType
    _max?: JobMaxAggregateInputType
  }

  export type JobGroupByOutputType = {
    id: string
    type: string
    status: string
    payload: JsonValue
    result: JsonValue | null
    error: string | null
    userId: string | null
    createdAt: Date
    updatedAt: Date
    _count: JobCountAggregateOutputType | null
    _min: JobMinAggregateOutputType | null
    _max: JobMaxAggregateOutputType | null
  }

  type GetJobGroupByPayload<T extends JobGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<JobGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof JobGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], JobGroupByOutputType[P]>
            : GetScalarType<T[P], JobGroupByOutputType[P]>
        }
      >
    >


  export type JobSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    status?: boolean
    payload?: boolean
    result?: boolean
    error?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["job"]>

  export type JobSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    status?: boolean
    payload?: boolean
    result?: boolean
    error?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["job"]>

  export type JobSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    status?: boolean
    payload?: boolean
    result?: boolean
    error?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["job"]>

  export type JobSelectScalar = {
    id?: boolean
    type?: boolean
    status?: boolean
    payload?: boolean
    result?: boolean
    error?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type JobOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "type" | "status" | "payload" | "result" | "error" | "userId" | "createdAt" | "updatedAt", ExtArgs["result"]["job"]>

  export type $JobPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Job"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      type: string
      status: string
      payload: Prisma.JsonValue
      result: Prisma.JsonValue | null
      error: string | null
      /**
       * Owner of the job. Nullable for legacy rows + worker-internal jobs.
       */
      userId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["job"]>
    composites: {}
  }

  type JobGetPayload<S extends boolean | null | undefined | JobDefaultArgs> = $Result.GetResult<Prisma.$JobPayload, S>

  type JobCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<JobFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: JobCountAggregateInputType | true
    }

  export interface JobDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Job'], meta: { name: 'Job' } }
    /**
     * Find zero or one Job that matches the filter.
     * @param {JobFindUniqueArgs} args - Arguments to find a Job
     * @example
     * // Get one Job
     * const job = await prisma.job.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends JobFindUniqueArgs>(args: SelectSubset<T, JobFindUniqueArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Job that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {JobFindUniqueOrThrowArgs} args - Arguments to find a Job
     * @example
     * // Get one Job
     * const job = await prisma.job.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends JobFindUniqueOrThrowArgs>(args: SelectSubset<T, JobFindUniqueOrThrowArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Job that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobFindFirstArgs} args - Arguments to find a Job
     * @example
     * // Get one Job
     * const job = await prisma.job.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends JobFindFirstArgs>(args?: SelectSubset<T, JobFindFirstArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Job that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobFindFirstOrThrowArgs} args - Arguments to find a Job
     * @example
     * // Get one Job
     * const job = await prisma.job.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends JobFindFirstOrThrowArgs>(args?: SelectSubset<T, JobFindFirstOrThrowArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Jobs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Jobs
     * const jobs = await prisma.job.findMany()
     * 
     * // Get first 10 Jobs
     * const jobs = await prisma.job.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const jobWithIdOnly = await prisma.job.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends JobFindManyArgs>(args?: SelectSubset<T, JobFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Job.
     * @param {JobCreateArgs} args - Arguments to create a Job.
     * @example
     * // Create one Job
     * const Job = await prisma.job.create({
     *   data: {
     *     // ... data to create a Job
     *   }
     * })
     * 
     */
    create<T extends JobCreateArgs>(args: SelectSubset<T, JobCreateArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Jobs.
     * @param {JobCreateManyArgs} args - Arguments to create many Jobs.
     * @example
     * // Create many Jobs
     * const job = await prisma.job.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends JobCreateManyArgs>(args?: SelectSubset<T, JobCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Jobs and returns the data saved in the database.
     * @param {JobCreateManyAndReturnArgs} args - Arguments to create many Jobs.
     * @example
     * // Create many Jobs
     * const job = await prisma.job.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Jobs and only return the `id`
     * const jobWithIdOnly = await prisma.job.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends JobCreateManyAndReturnArgs>(args?: SelectSubset<T, JobCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Job.
     * @param {JobDeleteArgs} args - Arguments to delete one Job.
     * @example
     * // Delete one Job
     * const Job = await prisma.job.delete({
     *   where: {
     *     // ... filter to delete one Job
     *   }
     * })
     * 
     */
    delete<T extends JobDeleteArgs>(args: SelectSubset<T, JobDeleteArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Job.
     * @param {JobUpdateArgs} args - Arguments to update one Job.
     * @example
     * // Update one Job
     * const job = await prisma.job.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends JobUpdateArgs>(args: SelectSubset<T, JobUpdateArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Jobs.
     * @param {JobDeleteManyArgs} args - Arguments to filter Jobs to delete.
     * @example
     * // Delete a few Jobs
     * const { count } = await prisma.job.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends JobDeleteManyArgs>(args?: SelectSubset<T, JobDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Jobs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Jobs
     * const job = await prisma.job.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends JobUpdateManyArgs>(args: SelectSubset<T, JobUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Jobs and returns the data updated in the database.
     * @param {JobUpdateManyAndReturnArgs} args - Arguments to update many Jobs.
     * @example
     * // Update many Jobs
     * const job = await prisma.job.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Jobs and only return the `id`
     * const jobWithIdOnly = await prisma.job.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends JobUpdateManyAndReturnArgs>(args: SelectSubset<T, JobUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Job.
     * @param {JobUpsertArgs} args - Arguments to update or create a Job.
     * @example
     * // Update or create a Job
     * const job = await prisma.job.upsert({
     *   create: {
     *     // ... data to create a Job
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Job we want to update
     *   }
     * })
     */
    upsert<T extends JobUpsertArgs>(args: SelectSubset<T, JobUpsertArgs<ExtArgs>>): Prisma__JobClient<$Result.GetResult<Prisma.$JobPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Jobs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobCountArgs} args - Arguments to filter Jobs to count.
     * @example
     * // Count the number of Jobs
     * const count = await prisma.job.count({
     *   where: {
     *     // ... the filter for the Jobs we want to count
     *   }
     * })
    **/
    count<T extends JobCountArgs>(
      args?: Subset<T, JobCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], JobCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Job.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends JobAggregateArgs>(args: Subset<T, JobAggregateArgs>): Prisma.PrismaPromise<GetJobAggregateType<T>>

    /**
     * Group by Job.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {JobGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends JobGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: JobGroupByArgs['orderBy'] }
        : { orderBy?: JobGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, JobGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetJobGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Job model
   */
  readonly fields: JobFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Job.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__JobClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Job model
   */
  interface JobFieldRefs {
    readonly id: FieldRef<"Job", 'String'>
    readonly type: FieldRef<"Job", 'String'>
    readonly status: FieldRef<"Job", 'String'>
    readonly payload: FieldRef<"Job", 'Json'>
    readonly result: FieldRef<"Job", 'Json'>
    readonly error: FieldRef<"Job", 'String'>
    readonly userId: FieldRef<"Job", 'String'>
    readonly createdAt: FieldRef<"Job", 'DateTime'>
    readonly updatedAt: FieldRef<"Job", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Job findUnique
   */
  export type JobFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * Filter, which Job to fetch.
     */
    where: JobWhereUniqueInput
  }

  /**
   * Job findUniqueOrThrow
   */
  export type JobFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * Filter, which Job to fetch.
     */
    where: JobWhereUniqueInput
  }

  /**
   * Job findFirst
   */
  export type JobFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * Filter, which Job to fetch.
     */
    where?: JobWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Jobs to fetch.
     */
    orderBy?: JobOrderByWithRelationInput | JobOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Jobs.
     */
    cursor?: JobWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Jobs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Jobs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Jobs.
     */
    distinct?: JobScalarFieldEnum | JobScalarFieldEnum[]
  }

  /**
   * Job findFirstOrThrow
   */
  export type JobFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * Filter, which Job to fetch.
     */
    where?: JobWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Jobs to fetch.
     */
    orderBy?: JobOrderByWithRelationInput | JobOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Jobs.
     */
    cursor?: JobWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Jobs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Jobs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Jobs.
     */
    distinct?: JobScalarFieldEnum | JobScalarFieldEnum[]
  }

  /**
   * Job findMany
   */
  export type JobFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * Filter, which Jobs to fetch.
     */
    where?: JobWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Jobs to fetch.
     */
    orderBy?: JobOrderByWithRelationInput | JobOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Jobs.
     */
    cursor?: JobWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Jobs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Jobs.
     */
    skip?: number
    distinct?: JobScalarFieldEnum | JobScalarFieldEnum[]
  }

  /**
   * Job create
   */
  export type JobCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * The data needed to create a Job.
     */
    data: XOR<JobCreateInput, JobUncheckedCreateInput>
  }

  /**
   * Job createMany
   */
  export type JobCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Jobs.
     */
    data: JobCreateManyInput | JobCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Job createManyAndReturn
   */
  export type JobCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * The data used to create many Jobs.
     */
    data: JobCreateManyInput | JobCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Job update
   */
  export type JobUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * The data needed to update a Job.
     */
    data: XOR<JobUpdateInput, JobUncheckedUpdateInput>
    /**
     * Choose, which Job to update.
     */
    where: JobWhereUniqueInput
  }

  /**
   * Job updateMany
   */
  export type JobUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Jobs.
     */
    data: XOR<JobUpdateManyMutationInput, JobUncheckedUpdateManyInput>
    /**
     * Filter which Jobs to update
     */
    where?: JobWhereInput
    /**
     * Limit how many Jobs to update.
     */
    limit?: number
  }

  /**
   * Job updateManyAndReturn
   */
  export type JobUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * The data used to update Jobs.
     */
    data: XOR<JobUpdateManyMutationInput, JobUncheckedUpdateManyInput>
    /**
     * Filter which Jobs to update
     */
    where?: JobWhereInput
    /**
     * Limit how many Jobs to update.
     */
    limit?: number
  }

  /**
   * Job upsert
   */
  export type JobUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * The filter to search for the Job to update in case it exists.
     */
    where: JobWhereUniqueInput
    /**
     * In case the Job found by the `where` argument doesn't exist, create a new Job with this data.
     */
    create: XOR<JobCreateInput, JobUncheckedCreateInput>
    /**
     * In case the Job was found with the provided `where` argument, update it with this data.
     */
    update: XOR<JobUpdateInput, JobUncheckedUpdateInput>
  }

  /**
   * Job delete
   */
  export type JobDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
    /**
     * Filter which Job to delete.
     */
    where: JobWhereUniqueInput
  }

  /**
   * Job deleteMany
   */
  export type JobDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Jobs to delete
     */
    where?: JobWhereInput
    /**
     * Limit how many Jobs to delete.
     */
    limit?: number
  }

  /**
   * Job without action
   */
  export type JobDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Job
     */
    select?: JobSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Job
     */
    omit?: JobOmit<ExtArgs> | null
  }


  /**
   * Model Page
   */

  export type AggregatePage = {
    _count: PageCountAggregateOutputType | null
    _min: PageMinAggregateOutputType | null
    _max: PageMaxAggregateOutputType | null
  }

  export type PageMinAggregateOutputType = {
    id: string | null
    sourceType: string | null
    status: string | null
    sourceUrl: string | null
    publicUrl: string | null
    slug: string | null
    latestVersionId: string | null
    userId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PageMaxAggregateOutputType = {
    id: string | null
    sourceType: string | null
    status: string | null
    sourceUrl: string | null
    publicUrl: string | null
    slug: string | null
    latestVersionId: string | null
    userId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PageCountAggregateOutputType = {
    id: number
    sourceType: number
    status: number
    sourceUrl: number
    publicUrl: number
    slug: number
    publishedBundle: number
    latestVersionId: number
    userId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PageMinAggregateInputType = {
    id?: true
    sourceType?: true
    status?: true
    sourceUrl?: true
    publicUrl?: true
    slug?: true
    latestVersionId?: true
    userId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PageMaxAggregateInputType = {
    id?: true
    sourceType?: true
    status?: true
    sourceUrl?: true
    publicUrl?: true
    slug?: true
    latestVersionId?: true
    userId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PageCountAggregateInputType = {
    id?: true
    sourceType?: true
    status?: true
    sourceUrl?: true
    publicUrl?: true
    slug?: true
    publishedBundle?: true
    latestVersionId?: true
    userId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Page to aggregate.
     */
    where?: PageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Pages to fetch.
     */
    orderBy?: PageOrderByWithRelationInput | PageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Pages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Pages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Pages
    **/
    _count?: true | PageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PageMaxAggregateInputType
  }

  export type GetPageAggregateType<T extends PageAggregateArgs> = {
        [P in keyof T & keyof AggregatePage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePage[P]>
      : GetScalarType<T[P], AggregatePage[P]>
  }




  export type PageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PageWhereInput
    orderBy?: PageOrderByWithAggregationInput | PageOrderByWithAggregationInput[]
    by: PageScalarFieldEnum[] | PageScalarFieldEnum
    having?: PageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PageCountAggregateInputType | true
    _min?: PageMinAggregateInputType
    _max?: PageMaxAggregateInputType
  }

  export type PageGroupByOutputType = {
    id: string
    sourceType: string
    status: string
    sourceUrl: string | null
    publicUrl: string | null
    slug: string | null
    publishedBundle: JsonValue | null
    latestVersionId: string | null
    userId: string | null
    createdAt: Date
    updatedAt: Date
    _count: PageCountAggregateOutputType | null
    _min: PageMinAggregateOutputType | null
    _max: PageMaxAggregateOutputType | null
  }

  type GetPageGroupByPayload<T extends PageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PageGroupByOutputType[P]>
            : GetScalarType<T[P], PageGroupByOutputType[P]>
        }
      >
    >


  export type PageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sourceType?: boolean
    status?: boolean
    sourceUrl?: boolean
    publicUrl?: boolean
    slug?: boolean
    publishedBundle?: boolean
    latestVersionId?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["page"]>

  export type PageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sourceType?: boolean
    status?: boolean
    sourceUrl?: boolean
    publicUrl?: boolean
    slug?: boolean
    publishedBundle?: boolean
    latestVersionId?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["page"]>

  export type PageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sourceType?: boolean
    status?: boolean
    sourceUrl?: boolean
    publicUrl?: boolean
    slug?: boolean
    publishedBundle?: boolean
    latestVersionId?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["page"]>

  export type PageSelectScalar = {
    id?: boolean
    sourceType?: boolean
    status?: boolean
    sourceUrl?: boolean
    publicUrl?: boolean
    slug?: boolean
    publishedBundle?: boolean
    latestVersionId?: boolean
    userId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "sourceType" | "status" | "sourceUrl" | "publicUrl" | "slug" | "publishedBundle" | "latestVersionId" | "userId" | "createdAt" | "updatedAt", ExtArgs["result"]["page"]>

  export type $PagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Page"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      sourceType: string
      status: string
      sourceUrl: string | null
      publicUrl: string | null
      slug: string | null
      publishedBundle: Prisma.JsonValue | null
      latestVersionId: string | null
      /**
       * Owner of the page. Nullable for legacy rows created before auth.
       */
      userId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["page"]>
    composites: {}
  }

  type PageGetPayload<S extends boolean | null | undefined | PageDefaultArgs> = $Result.GetResult<Prisma.$PagePayload, S>

  type PageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PageCountAggregateInputType | true
    }

  export interface PageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Page'], meta: { name: 'Page' } }
    /**
     * Find zero or one Page that matches the filter.
     * @param {PageFindUniqueArgs} args - Arguments to find a Page
     * @example
     * // Get one Page
     * const page = await prisma.page.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PageFindUniqueArgs>(args: SelectSubset<T, PageFindUniqueArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Page that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PageFindUniqueOrThrowArgs} args - Arguments to find a Page
     * @example
     * // Get one Page
     * const page = await prisma.page.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PageFindUniqueOrThrowArgs>(args: SelectSubset<T, PageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Page that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageFindFirstArgs} args - Arguments to find a Page
     * @example
     * // Get one Page
     * const page = await prisma.page.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PageFindFirstArgs>(args?: SelectSubset<T, PageFindFirstArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Page that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageFindFirstOrThrowArgs} args - Arguments to find a Page
     * @example
     * // Get one Page
     * const page = await prisma.page.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PageFindFirstOrThrowArgs>(args?: SelectSubset<T, PageFindFirstOrThrowArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Pages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Pages
     * const pages = await prisma.page.findMany()
     * 
     * // Get first 10 Pages
     * const pages = await prisma.page.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pageWithIdOnly = await prisma.page.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PageFindManyArgs>(args?: SelectSubset<T, PageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Page.
     * @param {PageCreateArgs} args - Arguments to create a Page.
     * @example
     * // Create one Page
     * const Page = await prisma.page.create({
     *   data: {
     *     // ... data to create a Page
     *   }
     * })
     * 
     */
    create<T extends PageCreateArgs>(args: SelectSubset<T, PageCreateArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Pages.
     * @param {PageCreateManyArgs} args - Arguments to create many Pages.
     * @example
     * // Create many Pages
     * const page = await prisma.page.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PageCreateManyArgs>(args?: SelectSubset<T, PageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Pages and returns the data saved in the database.
     * @param {PageCreateManyAndReturnArgs} args - Arguments to create many Pages.
     * @example
     * // Create many Pages
     * const page = await prisma.page.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Pages and only return the `id`
     * const pageWithIdOnly = await prisma.page.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PageCreateManyAndReturnArgs>(args?: SelectSubset<T, PageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Page.
     * @param {PageDeleteArgs} args - Arguments to delete one Page.
     * @example
     * // Delete one Page
     * const Page = await prisma.page.delete({
     *   where: {
     *     // ... filter to delete one Page
     *   }
     * })
     * 
     */
    delete<T extends PageDeleteArgs>(args: SelectSubset<T, PageDeleteArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Page.
     * @param {PageUpdateArgs} args - Arguments to update one Page.
     * @example
     * // Update one Page
     * const page = await prisma.page.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PageUpdateArgs>(args: SelectSubset<T, PageUpdateArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Pages.
     * @param {PageDeleteManyArgs} args - Arguments to filter Pages to delete.
     * @example
     * // Delete a few Pages
     * const { count } = await prisma.page.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PageDeleteManyArgs>(args?: SelectSubset<T, PageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Pages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Pages
     * const page = await prisma.page.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PageUpdateManyArgs>(args: SelectSubset<T, PageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Pages and returns the data updated in the database.
     * @param {PageUpdateManyAndReturnArgs} args - Arguments to update many Pages.
     * @example
     * // Update many Pages
     * const page = await prisma.page.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Pages and only return the `id`
     * const pageWithIdOnly = await prisma.page.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PageUpdateManyAndReturnArgs>(args: SelectSubset<T, PageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Page.
     * @param {PageUpsertArgs} args - Arguments to update or create a Page.
     * @example
     * // Update or create a Page
     * const page = await prisma.page.upsert({
     *   create: {
     *     // ... data to create a Page
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Page we want to update
     *   }
     * })
     */
    upsert<T extends PageUpsertArgs>(args: SelectSubset<T, PageUpsertArgs<ExtArgs>>): Prisma__PageClient<$Result.GetResult<Prisma.$PagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Pages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageCountArgs} args - Arguments to filter Pages to count.
     * @example
     * // Count the number of Pages
     * const count = await prisma.page.count({
     *   where: {
     *     // ... the filter for the Pages we want to count
     *   }
     * })
    **/
    count<T extends PageCountArgs>(
      args?: Subset<T, PageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Page.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PageAggregateArgs>(args: Subset<T, PageAggregateArgs>): Prisma.PrismaPromise<GetPageAggregateType<T>>

    /**
     * Group by Page.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PageGroupByArgs['orderBy'] }
        : { orderBy?: PageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Page model
   */
  readonly fields: PageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Page.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Page model
   */
  interface PageFieldRefs {
    readonly id: FieldRef<"Page", 'String'>
    readonly sourceType: FieldRef<"Page", 'String'>
    readonly status: FieldRef<"Page", 'String'>
    readonly sourceUrl: FieldRef<"Page", 'String'>
    readonly publicUrl: FieldRef<"Page", 'String'>
    readonly slug: FieldRef<"Page", 'String'>
    readonly publishedBundle: FieldRef<"Page", 'Json'>
    readonly latestVersionId: FieldRef<"Page", 'String'>
    readonly userId: FieldRef<"Page", 'String'>
    readonly createdAt: FieldRef<"Page", 'DateTime'>
    readonly updatedAt: FieldRef<"Page", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Page findUnique
   */
  export type PageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * Filter, which Page to fetch.
     */
    where: PageWhereUniqueInput
  }

  /**
   * Page findUniqueOrThrow
   */
  export type PageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * Filter, which Page to fetch.
     */
    where: PageWhereUniqueInput
  }

  /**
   * Page findFirst
   */
  export type PageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * Filter, which Page to fetch.
     */
    where?: PageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Pages to fetch.
     */
    orderBy?: PageOrderByWithRelationInput | PageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Pages.
     */
    cursor?: PageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Pages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Pages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Pages.
     */
    distinct?: PageScalarFieldEnum | PageScalarFieldEnum[]
  }

  /**
   * Page findFirstOrThrow
   */
  export type PageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * Filter, which Page to fetch.
     */
    where?: PageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Pages to fetch.
     */
    orderBy?: PageOrderByWithRelationInput | PageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Pages.
     */
    cursor?: PageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Pages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Pages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Pages.
     */
    distinct?: PageScalarFieldEnum | PageScalarFieldEnum[]
  }

  /**
   * Page findMany
   */
  export type PageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * Filter, which Pages to fetch.
     */
    where?: PageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Pages to fetch.
     */
    orderBy?: PageOrderByWithRelationInput | PageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Pages.
     */
    cursor?: PageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Pages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Pages.
     */
    skip?: number
    distinct?: PageScalarFieldEnum | PageScalarFieldEnum[]
  }

  /**
   * Page create
   */
  export type PageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * The data needed to create a Page.
     */
    data: XOR<PageCreateInput, PageUncheckedCreateInput>
  }

  /**
   * Page createMany
   */
  export type PageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Pages.
     */
    data: PageCreateManyInput | PageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Page createManyAndReturn
   */
  export type PageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * The data used to create many Pages.
     */
    data: PageCreateManyInput | PageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Page update
   */
  export type PageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * The data needed to update a Page.
     */
    data: XOR<PageUpdateInput, PageUncheckedUpdateInput>
    /**
     * Choose, which Page to update.
     */
    where: PageWhereUniqueInput
  }

  /**
   * Page updateMany
   */
  export type PageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Pages.
     */
    data: XOR<PageUpdateManyMutationInput, PageUncheckedUpdateManyInput>
    /**
     * Filter which Pages to update
     */
    where?: PageWhereInput
    /**
     * Limit how many Pages to update.
     */
    limit?: number
  }

  /**
   * Page updateManyAndReturn
   */
  export type PageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * The data used to update Pages.
     */
    data: XOR<PageUpdateManyMutationInput, PageUncheckedUpdateManyInput>
    /**
     * Filter which Pages to update
     */
    where?: PageWhereInput
    /**
     * Limit how many Pages to update.
     */
    limit?: number
  }

  /**
   * Page upsert
   */
  export type PageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * The filter to search for the Page to update in case it exists.
     */
    where: PageWhereUniqueInput
    /**
     * In case the Page found by the `where` argument doesn't exist, create a new Page with this data.
     */
    create: XOR<PageCreateInput, PageUncheckedCreateInput>
    /**
     * In case the Page was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PageUpdateInput, PageUncheckedUpdateInput>
  }

  /**
   * Page delete
   */
  export type PageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
    /**
     * Filter which Page to delete.
     */
    where: PageWhereUniqueInput
  }

  /**
   * Page deleteMany
   */
  export type PageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Pages to delete
     */
    where?: PageWhereInput
    /**
     * Limit how many Pages to delete.
     */
    limit?: number
  }

  /**
   * Page without action
   */
  export type PageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Page
     */
    select?: PageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Page
     */
    omit?: PageOmit<ExtArgs> | null
  }


  /**
   * Model PageVersion
   */

  export type AggregatePageVersion = {
    _count: PageVersionCountAggregateOutputType | null
    _min: PageVersionMinAggregateOutputType | null
    _max: PageVersionMaxAggregateOutputType | null
  }

  export type PageVersionMinAggregateOutputType = {
    id: string | null
    pageId: string | null
    title: string | null
    html: string | null
    createdAt: Date | null
  }

  export type PageVersionMaxAggregateOutputType = {
    id: string | null
    pageId: string | null
    title: string | null
    html: string | null
    createdAt: Date | null
  }

  export type PageVersionCountAggregateOutputType = {
    id: number
    pageId: number
    title: number
    html: number
    meta: number
    createdAt: number
    _all: number
  }


  export type PageVersionMinAggregateInputType = {
    id?: true
    pageId?: true
    title?: true
    html?: true
    createdAt?: true
  }

  export type PageVersionMaxAggregateInputType = {
    id?: true
    pageId?: true
    title?: true
    html?: true
    createdAt?: true
  }

  export type PageVersionCountAggregateInputType = {
    id?: true
    pageId?: true
    title?: true
    html?: true
    meta?: true
    createdAt?: true
    _all?: true
  }

  export type PageVersionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PageVersion to aggregate.
     */
    where?: PageVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVersions to fetch.
     */
    orderBy?: PageVersionOrderByWithRelationInput | PageVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PageVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PageVersions
    **/
    _count?: true | PageVersionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PageVersionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PageVersionMaxAggregateInputType
  }

  export type GetPageVersionAggregateType<T extends PageVersionAggregateArgs> = {
        [P in keyof T & keyof AggregatePageVersion]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePageVersion[P]>
      : GetScalarType<T[P], AggregatePageVersion[P]>
  }




  export type PageVersionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PageVersionWhereInput
    orderBy?: PageVersionOrderByWithAggregationInput | PageVersionOrderByWithAggregationInput[]
    by: PageVersionScalarFieldEnum[] | PageVersionScalarFieldEnum
    having?: PageVersionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PageVersionCountAggregateInputType | true
    _min?: PageVersionMinAggregateInputType
    _max?: PageVersionMaxAggregateInputType
  }

  export type PageVersionGroupByOutputType = {
    id: string
    pageId: string
    title: string
    html: string
    meta: JsonValue
    createdAt: Date
    _count: PageVersionCountAggregateOutputType | null
    _min: PageVersionMinAggregateOutputType | null
    _max: PageVersionMaxAggregateOutputType | null
  }

  type GetPageVersionGroupByPayload<T extends PageVersionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PageVersionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PageVersionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PageVersionGroupByOutputType[P]>
            : GetScalarType<T[P], PageVersionGroupByOutputType[P]>
        }
      >
    >


  export type PageVersionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageId?: boolean
    title?: boolean
    html?: boolean
    meta?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["pageVersion"]>

  export type PageVersionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageId?: boolean
    title?: boolean
    html?: boolean
    meta?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["pageVersion"]>

  export type PageVersionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageId?: boolean
    title?: boolean
    html?: boolean
    meta?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["pageVersion"]>

  export type PageVersionSelectScalar = {
    id?: boolean
    pageId?: boolean
    title?: boolean
    html?: boolean
    meta?: boolean
    createdAt?: boolean
  }

  export type PageVersionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "pageId" | "title" | "html" | "meta" | "createdAt", ExtArgs["result"]["pageVersion"]>

  export type $PageVersionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PageVersion"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      pageId: string
      title: string
      html: string
      meta: Prisma.JsonValue
      createdAt: Date
    }, ExtArgs["result"]["pageVersion"]>
    composites: {}
  }

  type PageVersionGetPayload<S extends boolean | null | undefined | PageVersionDefaultArgs> = $Result.GetResult<Prisma.$PageVersionPayload, S>

  type PageVersionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PageVersionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PageVersionCountAggregateInputType | true
    }

  export interface PageVersionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PageVersion'], meta: { name: 'PageVersion' } }
    /**
     * Find zero or one PageVersion that matches the filter.
     * @param {PageVersionFindUniqueArgs} args - Arguments to find a PageVersion
     * @example
     * // Get one PageVersion
     * const pageVersion = await prisma.pageVersion.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PageVersionFindUniqueArgs>(args: SelectSubset<T, PageVersionFindUniqueArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PageVersion that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PageVersionFindUniqueOrThrowArgs} args - Arguments to find a PageVersion
     * @example
     * // Get one PageVersion
     * const pageVersion = await prisma.pageVersion.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PageVersionFindUniqueOrThrowArgs>(args: SelectSubset<T, PageVersionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PageVersion that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionFindFirstArgs} args - Arguments to find a PageVersion
     * @example
     * // Get one PageVersion
     * const pageVersion = await prisma.pageVersion.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PageVersionFindFirstArgs>(args?: SelectSubset<T, PageVersionFindFirstArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PageVersion that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionFindFirstOrThrowArgs} args - Arguments to find a PageVersion
     * @example
     * // Get one PageVersion
     * const pageVersion = await prisma.pageVersion.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PageVersionFindFirstOrThrowArgs>(args?: SelectSubset<T, PageVersionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PageVersions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PageVersions
     * const pageVersions = await prisma.pageVersion.findMany()
     * 
     * // Get first 10 PageVersions
     * const pageVersions = await prisma.pageVersion.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pageVersionWithIdOnly = await prisma.pageVersion.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PageVersionFindManyArgs>(args?: SelectSubset<T, PageVersionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PageVersion.
     * @param {PageVersionCreateArgs} args - Arguments to create a PageVersion.
     * @example
     * // Create one PageVersion
     * const PageVersion = await prisma.pageVersion.create({
     *   data: {
     *     // ... data to create a PageVersion
     *   }
     * })
     * 
     */
    create<T extends PageVersionCreateArgs>(args: SelectSubset<T, PageVersionCreateArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PageVersions.
     * @param {PageVersionCreateManyArgs} args - Arguments to create many PageVersions.
     * @example
     * // Create many PageVersions
     * const pageVersion = await prisma.pageVersion.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PageVersionCreateManyArgs>(args?: SelectSubset<T, PageVersionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PageVersions and returns the data saved in the database.
     * @param {PageVersionCreateManyAndReturnArgs} args - Arguments to create many PageVersions.
     * @example
     * // Create many PageVersions
     * const pageVersion = await prisma.pageVersion.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PageVersions and only return the `id`
     * const pageVersionWithIdOnly = await prisma.pageVersion.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PageVersionCreateManyAndReturnArgs>(args?: SelectSubset<T, PageVersionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PageVersion.
     * @param {PageVersionDeleteArgs} args - Arguments to delete one PageVersion.
     * @example
     * // Delete one PageVersion
     * const PageVersion = await prisma.pageVersion.delete({
     *   where: {
     *     // ... filter to delete one PageVersion
     *   }
     * })
     * 
     */
    delete<T extends PageVersionDeleteArgs>(args: SelectSubset<T, PageVersionDeleteArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PageVersion.
     * @param {PageVersionUpdateArgs} args - Arguments to update one PageVersion.
     * @example
     * // Update one PageVersion
     * const pageVersion = await prisma.pageVersion.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PageVersionUpdateArgs>(args: SelectSubset<T, PageVersionUpdateArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PageVersions.
     * @param {PageVersionDeleteManyArgs} args - Arguments to filter PageVersions to delete.
     * @example
     * // Delete a few PageVersions
     * const { count } = await prisma.pageVersion.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PageVersionDeleteManyArgs>(args?: SelectSubset<T, PageVersionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PageVersions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PageVersions
     * const pageVersion = await prisma.pageVersion.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PageVersionUpdateManyArgs>(args: SelectSubset<T, PageVersionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PageVersions and returns the data updated in the database.
     * @param {PageVersionUpdateManyAndReturnArgs} args - Arguments to update many PageVersions.
     * @example
     * // Update many PageVersions
     * const pageVersion = await prisma.pageVersion.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PageVersions and only return the `id`
     * const pageVersionWithIdOnly = await prisma.pageVersion.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PageVersionUpdateManyAndReturnArgs>(args: SelectSubset<T, PageVersionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PageVersion.
     * @param {PageVersionUpsertArgs} args - Arguments to update or create a PageVersion.
     * @example
     * // Update or create a PageVersion
     * const pageVersion = await prisma.pageVersion.upsert({
     *   create: {
     *     // ... data to create a PageVersion
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PageVersion we want to update
     *   }
     * })
     */
    upsert<T extends PageVersionUpsertArgs>(args: SelectSubset<T, PageVersionUpsertArgs<ExtArgs>>): Prisma__PageVersionClient<$Result.GetResult<Prisma.$PageVersionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PageVersions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionCountArgs} args - Arguments to filter PageVersions to count.
     * @example
     * // Count the number of PageVersions
     * const count = await prisma.pageVersion.count({
     *   where: {
     *     // ... the filter for the PageVersions we want to count
     *   }
     * })
    **/
    count<T extends PageVersionCountArgs>(
      args?: Subset<T, PageVersionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PageVersionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PageVersion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PageVersionAggregateArgs>(args: Subset<T, PageVersionAggregateArgs>): Prisma.PrismaPromise<GetPageVersionAggregateType<T>>

    /**
     * Group by PageVersion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PageVersionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PageVersionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PageVersionGroupByArgs['orderBy'] }
        : { orderBy?: PageVersionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PageVersionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPageVersionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PageVersion model
   */
  readonly fields: PageVersionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PageVersion.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PageVersionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PageVersion model
   */
  interface PageVersionFieldRefs {
    readonly id: FieldRef<"PageVersion", 'String'>
    readonly pageId: FieldRef<"PageVersion", 'String'>
    readonly title: FieldRef<"PageVersion", 'String'>
    readonly html: FieldRef<"PageVersion", 'String'>
    readonly meta: FieldRef<"PageVersion", 'Json'>
    readonly createdAt: FieldRef<"PageVersion", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PageVersion findUnique
   */
  export type PageVersionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * Filter, which PageVersion to fetch.
     */
    where: PageVersionWhereUniqueInput
  }

  /**
   * PageVersion findUniqueOrThrow
   */
  export type PageVersionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * Filter, which PageVersion to fetch.
     */
    where: PageVersionWhereUniqueInput
  }

  /**
   * PageVersion findFirst
   */
  export type PageVersionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * Filter, which PageVersion to fetch.
     */
    where?: PageVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVersions to fetch.
     */
    orderBy?: PageVersionOrderByWithRelationInput | PageVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PageVersions.
     */
    cursor?: PageVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PageVersions.
     */
    distinct?: PageVersionScalarFieldEnum | PageVersionScalarFieldEnum[]
  }

  /**
   * PageVersion findFirstOrThrow
   */
  export type PageVersionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * Filter, which PageVersion to fetch.
     */
    where?: PageVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVersions to fetch.
     */
    orderBy?: PageVersionOrderByWithRelationInput | PageVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PageVersions.
     */
    cursor?: PageVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PageVersions.
     */
    distinct?: PageVersionScalarFieldEnum | PageVersionScalarFieldEnum[]
  }

  /**
   * PageVersion findMany
   */
  export type PageVersionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * Filter, which PageVersions to fetch.
     */
    where?: PageVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PageVersions to fetch.
     */
    orderBy?: PageVersionOrderByWithRelationInput | PageVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PageVersions.
     */
    cursor?: PageVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PageVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PageVersions.
     */
    skip?: number
    distinct?: PageVersionScalarFieldEnum | PageVersionScalarFieldEnum[]
  }

  /**
   * PageVersion create
   */
  export type PageVersionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * The data needed to create a PageVersion.
     */
    data: XOR<PageVersionCreateInput, PageVersionUncheckedCreateInput>
  }

  /**
   * PageVersion createMany
   */
  export type PageVersionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PageVersions.
     */
    data: PageVersionCreateManyInput | PageVersionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PageVersion createManyAndReturn
   */
  export type PageVersionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * The data used to create many PageVersions.
     */
    data: PageVersionCreateManyInput | PageVersionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PageVersion update
   */
  export type PageVersionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * The data needed to update a PageVersion.
     */
    data: XOR<PageVersionUpdateInput, PageVersionUncheckedUpdateInput>
    /**
     * Choose, which PageVersion to update.
     */
    where: PageVersionWhereUniqueInput
  }

  /**
   * PageVersion updateMany
   */
  export type PageVersionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PageVersions.
     */
    data: XOR<PageVersionUpdateManyMutationInput, PageVersionUncheckedUpdateManyInput>
    /**
     * Filter which PageVersions to update
     */
    where?: PageVersionWhereInput
    /**
     * Limit how many PageVersions to update.
     */
    limit?: number
  }

  /**
   * PageVersion updateManyAndReturn
   */
  export type PageVersionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * The data used to update PageVersions.
     */
    data: XOR<PageVersionUpdateManyMutationInput, PageVersionUncheckedUpdateManyInput>
    /**
     * Filter which PageVersions to update
     */
    where?: PageVersionWhereInput
    /**
     * Limit how many PageVersions to update.
     */
    limit?: number
  }

  /**
   * PageVersion upsert
   */
  export type PageVersionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * The filter to search for the PageVersion to update in case it exists.
     */
    where: PageVersionWhereUniqueInput
    /**
     * In case the PageVersion found by the `where` argument doesn't exist, create a new PageVersion with this data.
     */
    create: XOR<PageVersionCreateInput, PageVersionUncheckedCreateInput>
    /**
     * In case the PageVersion was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PageVersionUpdateInput, PageVersionUncheckedUpdateInput>
  }

  /**
   * PageVersion delete
   */
  export type PageVersionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
    /**
     * Filter which PageVersion to delete.
     */
    where: PageVersionWhereUniqueInput
  }

  /**
   * PageVersion deleteMany
   */
  export type PageVersionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PageVersions to delete
     */
    where?: PageVersionWhereInput
    /**
     * Limit how many PageVersions to delete.
     */
    limit?: number
  }

  /**
   * PageVersion without action
   */
  export type PageVersionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PageVersion
     */
    select?: PageVersionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PageVersion
     */
    omit?: PageVersionOmit<ExtArgs> | null
  }


  /**
   * Model CustomDomain
   */

  export type AggregateCustomDomain = {
    _count: CustomDomainCountAggregateOutputType | null
    _min: CustomDomainMinAggregateOutputType | null
    _max: CustomDomainMaxAggregateOutputType | null
  }

  export type CustomDomainMinAggregateOutputType = {
    id: string | null
    pageId: string | null
    host: string | null
    verificationToken: string | null
    status: string | null
    verifiedAt: Date | null
    lastCheckedAt: Date | null
    lastCheckMessage: string | null
    label: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CustomDomainMaxAggregateOutputType = {
    id: string | null
    pageId: string | null
    host: string | null
    verificationToken: string | null
    status: string | null
    verifiedAt: Date | null
    lastCheckedAt: Date | null
    lastCheckMessage: string | null
    label: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CustomDomainCountAggregateOutputType = {
    id: number
    pageId: number
    host: number
    verificationToken: number
    status: number
    verifiedAt: number
    lastCheckedAt: number
    lastCheckMessage: number
    label: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CustomDomainMinAggregateInputType = {
    id?: true
    pageId?: true
    host?: true
    verificationToken?: true
    status?: true
    verifiedAt?: true
    lastCheckedAt?: true
    lastCheckMessage?: true
    label?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CustomDomainMaxAggregateInputType = {
    id?: true
    pageId?: true
    host?: true
    verificationToken?: true
    status?: true
    verifiedAt?: true
    lastCheckedAt?: true
    lastCheckMessage?: true
    label?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CustomDomainCountAggregateInputType = {
    id?: true
    pageId?: true
    host?: true
    verificationToken?: true
    status?: true
    verifiedAt?: true
    lastCheckedAt?: true
    lastCheckMessage?: true
    label?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CustomDomainAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomDomain to aggregate.
     */
    where?: CustomDomainWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomDomains to fetch.
     */
    orderBy?: CustomDomainOrderByWithRelationInput | CustomDomainOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomDomainWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomDomains from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomDomains.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CustomDomains
    **/
    _count?: true | CustomDomainCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomDomainMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomDomainMaxAggregateInputType
  }

  export type GetCustomDomainAggregateType<T extends CustomDomainAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomDomain]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomDomain[P]>
      : GetScalarType<T[P], AggregateCustomDomain[P]>
  }




  export type CustomDomainGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomDomainWhereInput
    orderBy?: CustomDomainOrderByWithAggregationInput | CustomDomainOrderByWithAggregationInput[]
    by: CustomDomainScalarFieldEnum[] | CustomDomainScalarFieldEnum
    having?: CustomDomainScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomDomainCountAggregateInputType | true
    _min?: CustomDomainMinAggregateInputType
    _max?: CustomDomainMaxAggregateInputType
  }

  export type CustomDomainGroupByOutputType = {
    id: string
    pageId: string
    host: string
    verificationToken: string
    status: string
    verifiedAt: Date | null
    lastCheckedAt: Date | null
    lastCheckMessage: string | null
    label: string | null
    createdAt: Date
    updatedAt: Date
    _count: CustomDomainCountAggregateOutputType | null
    _min: CustomDomainMinAggregateOutputType | null
    _max: CustomDomainMaxAggregateOutputType | null
  }

  type GetCustomDomainGroupByPayload<T extends CustomDomainGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomDomainGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomDomainGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomDomainGroupByOutputType[P]>
            : GetScalarType<T[P], CustomDomainGroupByOutputType[P]>
        }
      >
    >


  export type CustomDomainSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageId?: boolean
    host?: boolean
    verificationToken?: boolean
    status?: boolean
    verifiedAt?: boolean
    lastCheckedAt?: boolean
    lastCheckMessage?: boolean
    label?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["customDomain"]>

  export type CustomDomainSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageId?: boolean
    host?: boolean
    verificationToken?: boolean
    status?: boolean
    verifiedAt?: boolean
    lastCheckedAt?: boolean
    lastCheckMessage?: boolean
    label?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["customDomain"]>

  export type CustomDomainSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    pageId?: boolean
    host?: boolean
    verificationToken?: boolean
    status?: boolean
    verifiedAt?: boolean
    lastCheckedAt?: boolean
    lastCheckMessage?: boolean
    label?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["customDomain"]>

  export type CustomDomainSelectScalar = {
    id?: boolean
    pageId?: boolean
    host?: boolean
    verificationToken?: boolean
    status?: boolean
    verifiedAt?: boolean
    lastCheckedAt?: boolean
    lastCheckMessage?: boolean
    label?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CustomDomainOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "pageId" | "host" | "verificationToken" | "status" | "verifiedAt" | "lastCheckedAt" | "lastCheckMessage" | "label" | "createdAt" | "updatedAt", ExtArgs["result"]["customDomain"]>

  export type $CustomDomainPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CustomDomain"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      pageId: string
      /**
       * Lowercase hostname (no scheme/port). Unique across the system.
       */
      host: string
      /**
       * Random token the user must publish as TXT _criaai-verify.<host>.
       */
      verificationToken: string
      /**
       * pending | verified | active | error
       */
      status: string
      /**
       * Filled after successful TXT lookup.
       */
      verifiedAt: Date | null
      /**
       * Last verification attempt outcome (success or error message).
       */
      lastCheckedAt: Date | null
      lastCheckMessage: string | null
      /**
       * Optional friendly label shown in the UI.
       */
      label: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["customDomain"]>
    composites: {}
  }

  type CustomDomainGetPayload<S extends boolean | null | undefined | CustomDomainDefaultArgs> = $Result.GetResult<Prisma.$CustomDomainPayload, S>

  type CustomDomainCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CustomDomainFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomDomainCountAggregateInputType | true
    }

  export interface CustomDomainDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CustomDomain'], meta: { name: 'CustomDomain' } }
    /**
     * Find zero or one CustomDomain that matches the filter.
     * @param {CustomDomainFindUniqueArgs} args - Arguments to find a CustomDomain
     * @example
     * // Get one CustomDomain
     * const customDomain = await prisma.customDomain.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomDomainFindUniqueArgs>(args: SelectSubset<T, CustomDomainFindUniqueArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CustomDomain that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CustomDomainFindUniqueOrThrowArgs} args - Arguments to find a CustomDomain
     * @example
     * // Get one CustomDomain
     * const customDomain = await prisma.customDomain.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomDomainFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomDomainFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomDomain that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainFindFirstArgs} args - Arguments to find a CustomDomain
     * @example
     * // Get one CustomDomain
     * const customDomain = await prisma.customDomain.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomDomainFindFirstArgs>(args?: SelectSubset<T, CustomDomainFindFirstArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomDomain that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainFindFirstOrThrowArgs} args - Arguments to find a CustomDomain
     * @example
     * // Get one CustomDomain
     * const customDomain = await prisma.customDomain.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomDomainFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomDomainFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CustomDomains that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CustomDomains
     * const customDomains = await prisma.customDomain.findMany()
     * 
     * // Get first 10 CustomDomains
     * const customDomains = await prisma.customDomain.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customDomainWithIdOnly = await prisma.customDomain.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomDomainFindManyArgs>(args?: SelectSubset<T, CustomDomainFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CustomDomain.
     * @param {CustomDomainCreateArgs} args - Arguments to create a CustomDomain.
     * @example
     * // Create one CustomDomain
     * const CustomDomain = await prisma.customDomain.create({
     *   data: {
     *     // ... data to create a CustomDomain
     *   }
     * })
     * 
     */
    create<T extends CustomDomainCreateArgs>(args: SelectSubset<T, CustomDomainCreateArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CustomDomains.
     * @param {CustomDomainCreateManyArgs} args - Arguments to create many CustomDomains.
     * @example
     * // Create many CustomDomains
     * const customDomain = await prisma.customDomain.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomDomainCreateManyArgs>(args?: SelectSubset<T, CustomDomainCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CustomDomains and returns the data saved in the database.
     * @param {CustomDomainCreateManyAndReturnArgs} args - Arguments to create many CustomDomains.
     * @example
     * // Create many CustomDomains
     * const customDomain = await prisma.customDomain.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CustomDomains and only return the `id`
     * const customDomainWithIdOnly = await prisma.customDomain.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomDomainCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomDomainCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CustomDomain.
     * @param {CustomDomainDeleteArgs} args - Arguments to delete one CustomDomain.
     * @example
     * // Delete one CustomDomain
     * const CustomDomain = await prisma.customDomain.delete({
     *   where: {
     *     // ... filter to delete one CustomDomain
     *   }
     * })
     * 
     */
    delete<T extends CustomDomainDeleteArgs>(args: SelectSubset<T, CustomDomainDeleteArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CustomDomain.
     * @param {CustomDomainUpdateArgs} args - Arguments to update one CustomDomain.
     * @example
     * // Update one CustomDomain
     * const customDomain = await prisma.customDomain.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomDomainUpdateArgs>(args: SelectSubset<T, CustomDomainUpdateArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CustomDomains.
     * @param {CustomDomainDeleteManyArgs} args - Arguments to filter CustomDomains to delete.
     * @example
     * // Delete a few CustomDomains
     * const { count } = await prisma.customDomain.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomDomainDeleteManyArgs>(args?: SelectSubset<T, CustomDomainDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomDomains.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CustomDomains
     * const customDomain = await prisma.customDomain.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomDomainUpdateManyArgs>(args: SelectSubset<T, CustomDomainUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomDomains and returns the data updated in the database.
     * @param {CustomDomainUpdateManyAndReturnArgs} args - Arguments to update many CustomDomains.
     * @example
     * // Update many CustomDomains
     * const customDomain = await prisma.customDomain.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CustomDomains and only return the `id`
     * const customDomainWithIdOnly = await prisma.customDomain.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CustomDomainUpdateManyAndReturnArgs>(args: SelectSubset<T, CustomDomainUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CustomDomain.
     * @param {CustomDomainUpsertArgs} args - Arguments to update or create a CustomDomain.
     * @example
     * // Update or create a CustomDomain
     * const customDomain = await prisma.customDomain.upsert({
     *   create: {
     *     // ... data to create a CustomDomain
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CustomDomain we want to update
     *   }
     * })
     */
    upsert<T extends CustomDomainUpsertArgs>(args: SelectSubset<T, CustomDomainUpsertArgs<ExtArgs>>): Prisma__CustomDomainClient<$Result.GetResult<Prisma.$CustomDomainPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CustomDomains.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainCountArgs} args - Arguments to filter CustomDomains to count.
     * @example
     * // Count the number of CustomDomains
     * const count = await prisma.customDomain.count({
     *   where: {
     *     // ... the filter for the CustomDomains we want to count
     *   }
     * })
    **/
    count<T extends CustomDomainCountArgs>(
      args?: Subset<T, CustomDomainCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomDomainCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CustomDomain.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomDomainAggregateArgs>(args: Subset<T, CustomDomainAggregateArgs>): Prisma.PrismaPromise<GetCustomDomainAggregateType<T>>

    /**
     * Group by CustomDomain.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomDomainGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomDomainGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomDomainGroupByArgs['orderBy'] }
        : { orderBy?: CustomDomainGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomDomainGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomDomainGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CustomDomain model
   */
  readonly fields: CustomDomainFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CustomDomain.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomDomainClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CustomDomain model
   */
  interface CustomDomainFieldRefs {
    readonly id: FieldRef<"CustomDomain", 'String'>
    readonly pageId: FieldRef<"CustomDomain", 'String'>
    readonly host: FieldRef<"CustomDomain", 'String'>
    readonly verificationToken: FieldRef<"CustomDomain", 'String'>
    readonly status: FieldRef<"CustomDomain", 'String'>
    readonly verifiedAt: FieldRef<"CustomDomain", 'DateTime'>
    readonly lastCheckedAt: FieldRef<"CustomDomain", 'DateTime'>
    readonly lastCheckMessage: FieldRef<"CustomDomain", 'String'>
    readonly label: FieldRef<"CustomDomain", 'String'>
    readonly createdAt: FieldRef<"CustomDomain", 'DateTime'>
    readonly updatedAt: FieldRef<"CustomDomain", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CustomDomain findUnique
   */
  export type CustomDomainFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * Filter, which CustomDomain to fetch.
     */
    where: CustomDomainWhereUniqueInput
  }

  /**
   * CustomDomain findUniqueOrThrow
   */
  export type CustomDomainFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * Filter, which CustomDomain to fetch.
     */
    where: CustomDomainWhereUniqueInput
  }

  /**
   * CustomDomain findFirst
   */
  export type CustomDomainFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * Filter, which CustomDomain to fetch.
     */
    where?: CustomDomainWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomDomains to fetch.
     */
    orderBy?: CustomDomainOrderByWithRelationInput | CustomDomainOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomDomains.
     */
    cursor?: CustomDomainWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomDomains from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomDomains.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomDomains.
     */
    distinct?: CustomDomainScalarFieldEnum | CustomDomainScalarFieldEnum[]
  }

  /**
   * CustomDomain findFirstOrThrow
   */
  export type CustomDomainFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * Filter, which CustomDomain to fetch.
     */
    where?: CustomDomainWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomDomains to fetch.
     */
    orderBy?: CustomDomainOrderByWithRelationInput | CustomDomainOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomDomains.
     */
    cursor?: CustomDomainWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomDomains from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomDomains.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomDomains.
     */
    distinct?: CustomDomainScalarFieldEnum | CustomDomainScalarFieldEnum[]
  }

  /**
   * CustomDomain findMany
   */
  export type CustomDomainFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * Filter, which CustomDomains to fetch.
     */
    where?: CustomDomainWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomDomains to fetch.
     */
    orderBy?: CustomDomainOrderByWithRelationInput | CustomDomainOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CustomDomains.
     */
    cursor?: CustomDomainWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomDomains from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomDomains.
     */
    skip?: number
    distinct?: CustomDomainScalarFieldEnum | CustomDomainScalarFieldEnum[]
  }

  /**
   * CustomDomain create
   */
  export type CustomDomainCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * The data needed to create a CustomDomain.
     */
    data: XOR<CustomDomainCreateInput, CustomDomainUncheckedCreateInput>
  }

  /**
   * CustomDomain createMany
   */
  export type CustomDomainCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CustomDomains.
     */
    data: CustomDomainCreateManyInput | CustomDomainCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomDomain createManyAndReturn
   */
  export type CustomDomainCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * The data used to create many CustomDomains.
     */
    data: CustomDomainCreateManyInput | CustomDomainCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomDomain update
   */
  export type CustomDomainUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * The data needed to update a CustomDomain.
     */
    data: XOR<CustomDomainUpdateInput, CustomDomainUncheckedUpdateInput>
    /**
     * Choose, which CustomDomain to update.
     */
    where: CustomDomainWhereUniqueInput
  }

  /**
   * CustomDomain updateMany
   */
  export type CustomDomainUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CustomDomains.
     */
    data: XOR<CustomDomainUpdateManyMutationInput, CustomDomainUncheckedUpdateManyInput>
    /**
     * Filter which CustomDomains to update
     */
    where?: CustomDomainWhereInput
    /**
     * Limit how many CustomDomains to update.
     */
    limit?: number
  }

  /**
   * CustomDomain updateManyAndReturn
   */
  export type CustomDomainUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * The data used to update CustomDomains.
     */
    data: XOR<CustomDomainUpdateManyMutationInput, CustomDomainUncheckedUpdateManyInput>
    /**
     * Filter which CustomDomains to update
     */
    where?: CustomDomainWhereInput
    /**
     * Limit how many CustomDomains to update.
     */
    limit?: number
  }

  /**
   * CustomDomain upsert
   */
  export type CustomDomainUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * The filter to search for the CustomDomain to update in case it exists.
     */
    where: CustomDomainWhereUniqueInput
    /**
     * In case the CustomDomain found by the `where` argument doesn't exist, create a new CustomDomain with this data.
     */
    create: XOR<CustomDomainCreateInput, CustomDomainUncheckedCreateInput>
    /**
     * In case the CustomDomain was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomDomainUpdateInput, CustomDomainUncheckedUpdateInput>
  }

  /**
   * CustomDomain delete
   */
  export type CustomDomainDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
    /**
     * Filter which CustomDomain to delete.
     */
    where: CustomDomainWhereUniqueInput
  }

  /**
   * CustomDomain deleteMany
   */
  export type CustomDomainDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomDomains to delete
     */
    where?: CustomDomainWhereInput
    /**
     * Limit how many CustomDomains to delete.
     */
    limit?: number
  }

  /**
   * CustomDomain without action
   */
  export type CustomDomainDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomDomain
     */
    select?: CustomDomainSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomDomain
     */
    omit?: CustomDomainOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    name: 'name',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const JobScalarFieldEnum: {
    id: 'id',
    type: 'type',
    status: 'status',
    payload: 'payload',
    result: 'result',
    error: 'error',
    userId: 'userId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type JobScalarFieldEnum = (typeof JobScalarFieldEnum)[keyof typeof JobScalarFieldEnum]


  export const PageScalarFieldEnum: {
    id: 'id',
    sourceType: 'sourceType',
    status: 'status',
    sourceUrl: 'sourceUrl',
    publicUrl: 'publicUrl',
    slug: 'slug',
    publishedBundle: 'publishedBundle',
    latestVersionId: 'latestVersionId',
    userId: 'userId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PageScalarFieldEnum = (typeof PageScalarFieldEnum)[keyof typeof PageScalarFieldEnum]


  export const PageVersionScalarFieldEnum: {
    id: 'id',
    pageId: 'pageId',
    title: 'title',
    html: 'html',
    meta: 'meta',
    createdAt: 'createdAt'
  };

  export type PageVersionScalarFieldEnum = (typeof PageVersionScalarFieldEnum)[keyof typeof PageVersionScalarFieldEnum]


  export const CustomDomainScalarFieldEnum: {
    id: 'id',
    pageId: 'pageId',
    host: 'host',
    verificationToken: 'verificationToken',
    status: 'status',
    verifiedAt: 'verifiedAt',
    lastCheckedAt: 'lastCheckedAt',
    lastCheckMessage: 'lastCheckMessage',
    label: 'label',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CustomDomainScalarFieldEnum = (typeof CustomDomainScalarFieldEnum)[keyof typeof CustomDomainScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    passwordHash?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    passwordHash?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    passwordHash?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type JobWhereInput = {
    AND?: JobWhereInput | JobWhereInput[]
    OR?: JobWhereInput[]
    NOT?: JobWhereInput | JobWhereInput[]
    id?: StringFilter<"Job"> | string
    type?: StringFilter<"Job"> | string
    status?: StringFilter<"Job"> | string
    payload?: JsonFilter<"Job">
    result?: JsonNullableFilter<"Job">
    error?: StringNullableFilter<"Job"> | string | null
    userId?: StringNullableFilter<"Job"> | string | null
    createdAt?: DateTimeFilter<"Job"> | Date | string
    updatedAt?: DateTimeFilter<"Job"> | Date | string
  }

  export type JobOrderByWithRelationInput = {
    id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    payload?: SortOrder
    result?: SortOrderInput | SortOrder
    error?: SortOrderInput | SortOrder
    userId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type JobWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: JobWhereInput | JobWhereInput[]
    OR?: JobWhereInput[]
    NOT?: JobWhereInput | JobWhereInput[]
    type?: StringFilter<"Job"> | string
    status?: StringFilter<"Job"> | string
    payload?: JsonFilter<"Job">
    result?: JsonNullableFilter<"Job">
    error?: StringNullableFilter<"Job"> | string | null
    userId?: StringNullableFilter<"Job"> | string | null
    createdAt?: DateTimeFilter<"Job"> | Date | string
    updatedAt?: DateTimeFilter<"Job"> | Date | string
  }, "id">

  export type JobOrderByWithAggregationInput = {
    id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    payload?: SortOrder
    result?: SortOrderInput | SortOrder
    error?: SortOrderInput | SortOrder
    userId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: JobCountOrderByAggregateInput
    _max?: JobMaxOrderByAggregateInput
    _min?: JobMinOrderByAggregateInput
  }

  export type JobScalarWhereWithAggregatesInput = {
    AND?: JobScalarWhereWithAggregatesInput | JobScalarWhereWithAggregatesInput[]
    OR?: JobScalarWhereWithAggregatesInput[]
    NOT?: JobScalarWhereWithAggregatesInput | JobScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Job"> | string
    type?: StringWithAggregatesFilter<"Job"> | string
    status?: StringWithAggregatesFilter<"Job"> | string
    payload?: JsonWithAggregatesFilter<"Job">
    result?: JsonNullableWithAggregatesFilter<"Job">
    error?: StringNullableWithAggregatesFilter<"Job"> | string | null
    userId?: StringNullableWithAggregatesFilter<"Job"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Job"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Job"> | Date | string
  }

  export type PageWhereInput = {
    AND?: PageWhereInput | PageWhereInput[]
    OR?: PageWhereInput[]
    NOT?: PageWhereInput | PageWhereInput[]
    id?: StringFilter<"Page"> | string
    sourceType?: StringFilter<"Page"> | string
    status?: StringFilter<"Page"> | string
    sourceUrl?: StringNullableFilter<"Page"> | string | null
    publicUrl?: StringNullableFilter<"Page"> | string | null
    slug?: StringNullableFilter<"Page"> | string | null
    publishedBundle?: JsonNullableFilter<"Page">
    latestVersionId?: StringNullableFilter<"Page"> | string | null
    userId?: StringNullableFilter<"Page"> | string | null
    createdAt?: DateTimeFilter<"Page"> | Date | string
    updatedAt?: DateTimeFilter<"Page"> | Date | string
  }

  export type PageOrderByWithRelationInput = {
    id?: SortOrder
    sourceType?: SortOrder
    status?: SortOrder
    sourceUrl?: SortOrderInput | SortOrder
    publicUrl?: SortOrderInput | SortOrder
    slug?: SortOrderInput | SortOrder
    publishedBundle?: SortOrderInput | SortOrder
    latestVersionId?: SortOrderInput | SortOrder
    userId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PageWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    slug?: string
    AND?: PageWhereInput | PageWhereInput[]
    OR?: PageWhereInput[]
    NOT?: PageWhereInput | PageWhereInput[]
    sourceType?: StringFilter<"Page"> | string
    status?: StringFilter<"Page"> | string
    sourceUrl?: StringNullableFilter<"Page"> | string | null
    publicUrl?: StringNullableFilter<"Page"> | string | null
    publishedBundle?: JsonNullableFilter<"Page">
    latestVersionId?: StringNullableFilter<"Page"> | string | null
    userId?: StringNullableFilter<"Page"> | string | null
    createdAt?: DateTimeFilter<"Page"> | Date | string
    updatedAt?: DateTimeFilter<"Page"> | Date | string
  }, "id" | "slug">

  export type PageOrderByWithAggregationInput = {
    id?: SortOrder
    sourceType?: SortOrder
    status?: SortOrder
    sourceUrl?: SortOrderInput | SortOrder
    publicUrl?: SortOrderInput | SortOrder
    slug?: SortOrderInput | SortOrder
    publishedBundle?: SortOrderInput | SortOrder
    latestVersionId?: SortOrderInput | SortOrder
    userId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PageCountOrderByAggregateInput
    _max?: PageMaxOrderByAggregateInput
    _min?: PageMinOrderByAggregateInput
  }

  export type PageScalarWhereWithAggregatesInput = {
    AND?: PageScalarWhereWithAggregatesInput | PageScalarWhereWithAggregatesInput[]
    OR?: PageScalarWhereWithAggregatesInput[]
    NOT?: PageScalarWhereWithAggregatesInput | PageScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Page"> | string
    sourceType?: StringWithAggregatesFilter<"Page"> | string
    status?: StringWithAggregatesFilter<"Page"> | string
    sourceUrl?: StringNullableWithAggregatesFilter<"Page"> | string | null
    publicUrl?: StringNullableWithAggregatesFilter<"Page"> | string | null
    slug?: StringNullableWithAggregatesFilter<"Page"> | string | null
    publishedBundle?: JsonNullableWithAggregatesFilter<"Page">
    latestVersionId?: StringNullableWithAggregatesFilter<"Page"> | string | null
    userId?: StringNullableWithAggregatesFilter<"Page"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Page"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Page"> | Date | string
  }

  export type PageVersionWhereInput = {
    AND?: PageVersionWhereInput | PageVersionWhereInput[]
    OR?: PageVersionWhereInput[]
    NOT?: PageVersionWhereInput | PageVersionWhereInput[]
    id?: StringFilter<"PageVersion"> | string
    pageId?: StringFilter<"PageVersion"> | string
    title?: StringFilter<"PageVersion"> | string
    html?: StringFilter<"PageVersion"> | string
    meta?: JsonFilter<"PageVersion">
    createdAt?: DateTimeFilter<"PageVersion"> | Date | string
  }

  export type PageVersionOrderByWithRelationInput = {
    id?: SortOrder
    pageId?: SortOrder
    title?: SortOrder
    html?: SortOrder
    meta?: SortOrder
    createdAt?: SortOrder
  }

  export type PageVersionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PageVersionWhereInput | PageVersionWhereInput[]
    OR?: PageVersionWhereInput[]
    NOT?: PageVersionWhereInput | PageVersionWhereInput[]
    pageId?: StringFilter<"PageVersion"> | string
    title?: StringFilter<"PageVersion"> | string
    html?: StringFilter<"PageVersion"> | string
    meta?: JsonFilter<"PageVersion">
    createdAt?: DateTimeFilter<"PageVersion"> | Date | string
  }, "id">

  export type PageVersionOrderByWithAggregationInput = {
    id?: SortOrder
    pageId?: SortOrder
    title?: SortOrder
    html?: SortOrder
    meta?: SortOrder
    createdAt?: SortOrder
    _count?: PageVersionCountOrderByAggregateInput
    _max?: PageVersionMaxOrderByAggregateInput
    _min?: PageVersionMinOrderByAggregateInput
  }

  export type PageVersionScalarWhereWithAggregatesInput = {
    AND?: PageVersionScalarWhereWithAggregatesInput | PageVersionScalarWhereWithAggregatesInput[]
    OR?: PageVersionScalarWhereWithAggregatesInput[]
    NOT?: PageVersionScalarWhereWithAggregatesInput | PageVersionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PageVersion"> | string
    pageId?: StringWithAggregatesFilter<"PageVersion"> | string
    title?: StringWithAggregatesFilter<"PageVersion"> | string
    html?: StringWithAggregatesFilter<"PageVersion"> | string
    meta?: JsonWithAggregatesFilter<"PageVersion">
    createdAt?: DateTimeWithAggregatesFilter<"PageVersion"> | Date | string
  }

  export type CustomDomainWhereInput = {
    AND?: CustomDomainWhereInput | CustomDomainWhereInput[]
    OR?: CustomDomainWhereInput[]
    NOT?: CustomDomainWhereInput | CustomDomainWhereInput[]
    id?: StringFilter<"CustomDomain"> | string
    pageId?: StringFilter<"CustomDomain"> | string
    host?: StringFilter<"CustomDomain"> | string
    verificationToken?: StringFilter<"CustomDomain"> | string
    status?: StringFilter<"CustomDomain"> | string
    verifiedAt?: DateTimeNullableFilter<"CustomDomain"> | Date | string | null
    lastCheckedAt?: DateTimeNullableFilter<"CustomDomain"> | Date | string | null
    lastCheckMessage?: StringNullableFilter<"CustomDomain"> | string | null
    label?: StringNullableFilter<"CustomDomain"> | string | null
    createdAt?: DateTimeFilter<"CustomDomain"> | Date | string
    updatedAt?: DateTimeFilter<"CustomDomain"> | Date | string
  }

  export type CustomDomainOrderByWithRelationInput = {
    id?: SortOrder
    pageId?: SortOrder
    host?: SortOrder
    verificationToken?: SortOrder
    status?: SortOrder
    verifiedAt?: SortOrderInput | SortOrder
    lastCheckedAt?: SortOrderInput | SortOrder
    lastCheckMessage?: SortOrderInput | SortOrder
    label?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomDomainWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    host?: string
    AND?: CustomDomainWhereInput | CustomDomainWhereInput[]
    OR?: CustomDomainWhereInput[]
    NOT?: CustomDomainWhereInput | CustomDomainWhereInput[]
    pageId?: StringFilter<"CustomDomain"> | string
    verificationToken?: StringFilter<"CustomDomain"> | string
    status?: StringFilter<"CustomDomain"> | string
    verifiedAt?: DateTimeNullableFilter<"CustomDomain"> | Date | string | null
    lastCheckedAt?: DateTimeNullableFilter<"CustomDomain"> | Date | string | null
    lastCheckMessage?: StringNullableFilter<"CustomDomain"> | string | null
    label?: StringNullableFilter<"CustomDomain"> | string | null
    createdAt?: DateTimeFilter<"CustomDomain"> | Date | string
    updatedAt?: DateTimeFilter<"CustomDomain"> | Date | string
  }, "id" | "host">

  export type CustomDomainOrderByWithAggregationInput = {
    id?: SortOrder
    pageId?: SortOrder
    host?: SortOrder
    verificationToken?: SortOrder
    status?: SortOrder
    verifiedAt?: SortOrderInput | SortOrder
    lastCheckedAt?: SortOrderInput | SortOrder
    lastCheckMessage?: SortOrderInput | SortOrder
    label?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CustomDomainCountOrderByAggregateInput
    _max?: CustomDomainMaxOrderByAggregateInput
    _min?: CustomDomainMinOrderByAggregateInput
  }

  export type CustomDomainScalarWhereWithAggregatesInput = {
    AND?: CustomDomainScalarWhereWithAggregatesInput | CustomDomainScalarWhereWithAggregatesInput[]
    OR?: CustomDomainScalarWhereWithAggregatesInput[]
    NOT?: CustomDomainScalarWhereWithAggregatesInput | CustomDomainScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CustomDomain"> | string
    pageId?: StringWithAggregatesFilter<"CustomDomain"> | string
    host?: StringWithAggregatesFilter<"CustomDomain"> | string
    verificationToken?: StringWithAggregatesFilter<"CustomDomain"> | string
    status?: StringWithAggregatesFilter<"CustomDomain"> | string
    verifiedAt?: DateTimeNullableWithAggregatesFilter<"CustomDomain"> | Date | string | null
    lastCheckedAt?: DateTimeNullableWithAggregatesFilter<"CustomDomain"> | Date | string | null
    lastCheckMessage?: StringNullableWithAggregatesFilter<"CustomDomain"> | string | null
    label?: StringNullableWithAggregatesFilter<"CustomDomain"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"CustomDomain"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CustomDomain"> | Date | string
  }

  export type UserCreateInput = {
    id: string
    email: string
    passwordHash: string
    name?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type UserUncheckedCreateInput = {
    id: string
    email: string
    passwordHash: string
    name?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateManyInput = {
    id: string
    email: string
    passwordHash: string
    name?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type JobCreateInput = {
    id: string
    type: string
    status: string
    payload: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: string | null
    userId?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type JobUncheckedCreateInput = {
    id: string
    type: string
    status: string
    payload: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: string | null
    userId?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type JobUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    payload?: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type JobUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    payload?: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type JobCreateManyInput = {
    id: string
    type: string
    status: string
    payload: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: string | null
    userId?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type JobUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    payload?: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type JobUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    payload?: JsonNullValueInput | InputJsonValue
    result?: NullableJsonNullValueInput | InputJsonValue
    error?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageCreateInput = {
    id: string
    sourceType: string
    status: string
    sourceUrl?: string | null
    publicUrl?: string | null
    slug?: string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: string | null
    userId?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type PageUncheckedCreateInput = {
    id: string
    sourceType: string
    status: string
    sourceUrl?: string | null
    publicUrl?: string | null
    slug?: string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: string | null
    userId?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type PageUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    sourceUrl?: NullableStringFieldUpdateOperationsInput | string | null
    publicUrl?: NullableStringFieldUpdateOperationsInput | string | null
    slug?: NullableStringFieldUpdateOperationsInput | string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    sourceUrl?: NullableStringFieldUpdateOperationsInput | string | null
    publicUrl?: NullableStringFieldUpdateOperationsInput | string | null
    slug?: NullableStringFieldUpdateOperationsInput | string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageCreateManyInput = {
    id: string
    sourceType: string
    status: string
    sourceUrl?: string | null
    publicUrl?: string | null
    slug?: string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: string | null
    userId?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type PageUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    sourceUrl?: NullableStringFieldUpdateOperationsInput | string | null
    publicUrl?: NullableStringFieldUpdateOperationsInput | string | null
    slug?: NullableStringFieldUpdateOperationsInput | string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    sourceUrl?: NullableStringFieldUpdateOperationsInput | string | null
    publicUrl?: NullableStringFieldUpdateOperationsInput | string | null
    slug?: NullableStringFieldUpdateOperationsInput | string | null
    publishedBundle?: NullableJsonNullValueInput | InputJsonValue
    latestVersionId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageVersionCreateInput = {
    id: string
    pageId: string
    title: string
    html: string
    meta: JsonNullValueInput | InputJsonValue
    createdAt: Date | string
  }

  export type PageVersionUncheckedCreateInput = {
    id: string
    pageId: string
    title: string
    html: string
    meta: JsonNullValueInput | InputJsonValue
    createdAt: Date | string
  }

  export type PageVersionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    html?: StringFieldUpdateOperationsInput | string
    meta?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageVersionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    html?: StringFieldUpdateOperationsInput | string
    meta?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageVersionCreateManyInput = {
    id: string
    pageId: string
    title: string
    html: string
    meta: JsonNullValueInput | InputJsonValue
    createdAt: Date | string
  }

  export type PageVersionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    html?: StringFieldUpdateOperationsInput | string
    meta?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PageVersionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    html?: StringFieldUpdateOperationsInput | string
    meta?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomDomainCreateInput = {
    id: string
    pageId: string
    host: string
    verificationToken: string
    status: string
    verifiedAt?: Date | string | null
    lastCheckedAt?: Date | string | null
    lastCheckMessage?: string | null
    label?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type CustomDomainUncheckedCreateInput = {
    id: string
    pageId: string
    host: string
    verificationToken: string
    status: string
    verifiedAt?: Date | string | null
    lastCheckedAt?: Date | string | null
    lastCheckMessage?: string | null
    label?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type CustomDomainUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    verificationToken?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckMessage?: NullableStringFieldUpdateOperationsInput | string | null
    label?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomDomainUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    verificationToken?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckMessage?: NullableStringFieldUpdateOperationsInput | string | null
    label?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomDomainCreateManyInput = {
    id: string
    pageId: string
    host: string
    verificationToken: string
    status: string
    verifiedAt?: Date | string | null
    lastCheckedAt?: Date | string | null
    lastCheckMessage?: string | null
    label?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type CustomDomainUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    verificationToken?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckMessage?: NullableStringFieldUpdateOperationsInput | string | null
    label?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomDomainUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    pageId?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    verificationToken?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    verifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastCheckMessage?: NullableStringFieldUpdateOperationsInput | string | null
    label?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type JobCountOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    payload?: SortOrder
    result?: SortOrder
    error?: SortOrder
    userId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type JobMaxOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    error?: SortOrder
    userId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type JobMinOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    status?: SortOrder
    error?: SortOrder
    userId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type PageCountOrderByAggregateInput = {
    id?: SortOrder
    sourceType?: SortOrder
    status?: SortOrder
    sourceUrl?: SortOrder
    publicUrl?: SortOrder
    slug?: SortOrder
    publishedBundle?: SortOrder
    latestVersionId?: SortOrder
    userId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PageMaxOrderByAggregateInput = {
    id?: SortOrder
    sourceType?: SortOrder
    status?: SortOrder
    sourceUrl?: SortOrder
    publicUrl?: SortOrder
    slug?: SortOrder
    latestVersionId?: SortOrder
    userId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PageMinOrderByAggregateInput = {
    id?: SortOrder
    sourceType?: SortOrder
    status?: SortOrder
    sourceUrl?: SortOrder
    publicUrl?: SortOrder
    slug?: SortOrder
    latestVersionId?: SortOrder
    userId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PageVersionCountOrderByAggregateInput = {
    id?: SortOrder
    pageId?: SortOrder
    title?: SortOrder
    html?: SortOrder
    meta?: SortOrder
    createdAt?: SortOrder
  }

  export type PageVersionMaxOrderByAggregateInput = {
    id?: SortOrder
    pageId?: SortOrder
    title?: SortOrder
    html?: SortOrder
    createdAt?: SortOrder
  }

  export type PageVersionMinOrderByAggregateInput = {
    id?: SortOrder
    pageId?: SortOrder
    title?: SortOrder
    html?: SortOrder
    createdAt?: SortOrder
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type CustomDomainCountOrderByAggregateInput = {
    id?: SortOrder
    pageId?: SortOrder
    host?: SortOrder
    verificationToken?: SortOrder
    status?: SortOrder
    verifiedAt?: SortOrder
    lastCheckedAt?: SortOrder
    lastCheckMessage?: SortOrder
    label?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomDomainMaxOrderByAggregateInput = {
    id?: SortOrder
    pageId?: SortOrder
    host?: SortOrder
    verificationToken?: SortOrder
    status?: SortOrder
    verifiedAt?: SortOrder
    lastCheckedAt?: SortOrder
    lastCheckMessage?: SortOrder
    label?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CustomDomainMinOrderByAggregateInput = {
    id?: SortOrder
    pageId?: SortOrder
    host?: SortOrder
    verificationToken?: SortOrder
    status?: SortOrder
    verifiedAt?: SortOrder
    lastCheckedAt?: SortOrder
    lastCheckMessage?: SortOrder
    label?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}