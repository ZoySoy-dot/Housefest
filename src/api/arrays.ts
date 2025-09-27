function retain<T>(array_mut: T[], should_keep: (item: T) => boolean) {
    let last_kept_index = 0;

    for (let i = 0; i < array_mut.length; i++) {
        const current_item = array_mut[i];

        if (should_keep(current_item)) {
            array_mut[last_kept_index] = current_item;
            last_kept_index++;
        }
    }

    array_mut.length = last_kept_index;
}

export { retain };