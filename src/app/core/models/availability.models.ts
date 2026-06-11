export interface AvailabilitySlot {
    id: number;
    startTime: string;
    endTime: string;
    booked: boolean;
  }
  
  export interface AddSlotRequest {
    startTime: string;
    endTime: string;
  }