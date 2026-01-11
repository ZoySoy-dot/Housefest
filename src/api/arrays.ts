export function retain<T>(array: T[], predicate: (item: T) => boolean) {
    let i = 0;
    while (i < array.length) {
        if (predicate(array[i])) {
            i++;
        } else {
            array.splice(i, 1);
        }
    }
}
