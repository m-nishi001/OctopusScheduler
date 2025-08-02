// class TimeScheduler {

//     timeSchedules!: SchedulerEvent[];

//     constructor() {
//         this.loadTimeSchedule();
//     }

//     loadTimeSchedule() {
//         this.timeSchedules = [
//             new SchedulerEvent("EventA"),
//             new SchedulerEvent("EventB"),
//             new SchedulerEvent("EventC"),
//         ];
//     }

//     run() {
//         let index = 0;
//         const interval = setInterval(() => {
//             console.log(this.timeSchedules[index++]);
//             if (this.timeSchedules.length === index) clearInterval(interval);
//         }, 5000);
//     }
// }

// class SchedulerEvent {
//     public eventId: string
//     public eventName: string;

//     constructor(eventName: string, eventId: string | null = null) {
//         this.eventId = eventId ?? crypto.randomUUID();
//         this.eventName = eventName;
//     }
// }