export function getCurrentTime(timezone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    };

    if (timezone) {
        options.timeZone = timezone;
    }

    return new Date().toLocaleString('es-ES', options);
}
