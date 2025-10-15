export default function (api: any) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [],
    };
}
