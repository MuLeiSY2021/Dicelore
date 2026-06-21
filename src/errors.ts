export type DiceloreErrorCode =
  | "EXPR_EVAL"        // expr 解析/求值失败
  | "NOT_NUMERIC"      // 该掷/算术却给非数值
  | "RANGE_INVALID"    // 档位重叠 / 不全覆盖 / min>max / 落空
  | "ENTITY_NOT_FOUND" // 引用/目标实体不存在
  | "DIE_INVALID"      // 单骰串非法(resolve_outcome)
  | "NOT_FOUND"        // 通用目标缺失(pool/doc 等)
  | "INTERNAL";        // 未分类(兜底,不泄漏原始栈)

export class DiceloreError extends Error {
  code: DiceloreErrorCode;
  hint?: string;
  constructor(code: DiceloreErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "DiceloreError";
    this.code = code;
    this.hint = hint;
  }
}
