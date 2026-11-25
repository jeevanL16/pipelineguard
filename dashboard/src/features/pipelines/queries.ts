import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPipeline,
  getPipelines,
  getRuns,
  type ApiPipeline,
} from "../../services/api";

export function usePipelinesQuery() {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: getPipelines,
  });
}

export function useRunsQuery() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: getRuns,
  });
}

export function useCreatePipelineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPipeline,
    onSuccess: (created) => {
      queryClient.setQueryData<ApiPipeline[]>(["pipelines"], (prev) =>
        prev ? [created, ...prev.filter((p) => p.pipeline_id !== created.pipeline_id)] : [created]
      );
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}
