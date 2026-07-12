/** AI生成と永続化を別操作として固定するための境界。 */
export async function generateForReview<T>(generate: () => Promise<T>, validate: (result: T) => void): Promise<T> {
  const result = await generate();
  validate(result);
  return result;
}

export async function persistReviewedResult<T, R>(result: T, validate: (result: T) => void, persist: () => Promise<R>): Promise<R> {
  validate(result);
  return persist();
}
