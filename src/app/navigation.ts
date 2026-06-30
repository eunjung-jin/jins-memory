// 네비게이션 타입 정의
export type RootStackParamList = {
  Timeline: undefined;
  TripDetail: {
    tripId: string;
    title: string;
    dateRange: string;
    locationSummary: string | null;
  };
};
