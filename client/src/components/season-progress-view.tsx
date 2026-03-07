import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
interface SeasonProgressData {
  id?: number;
  watchlistId?: number;
  seasonNumber: number;
  startDate?: string | null;
  finishDate?: string | null;
  grade?: string | null;
  rating?: number | null;
}

interface SeasonProgressViewProps {
  seasonNumber: number;
  data: SeasonProgressData;
  onEdit: () => void;
}

export function SeasonProgressView({ 
  seasonNumber,
  data,
  onEdit
}: SeasonProgressViewProps) {
  // Format dates for display
  const startDate = data.startDate ? format(new Date(data.startDate + 'T00:00:00'), 'MMM dd, yyyy') : 'Not set';
  const finishDate = data.finishDate ? format(new Date(data.finishDate + 'T00:00:00'), 'MMM dd, yyyy') : 'Not set';
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>Season {seasonNumber}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onEdit}
            className="h-8 px-2 text-muted-foreground"
          >
            <i className="ri-edit-line mr-1"></i> Edit
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-4 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Start Date:</span>
          </div>
          <div>{startDate}</div>
          
          <div>
            <span className="font-medium text-muted-foreground">Finish Date:</span>
          </div>
          <div>{finishDate}</div>
          
          <div>
            <span className="font-medium text-muted-foreground">Grade:</span>
          </div>
          <div>{data.grade || 'Not graded'}</div>
          
          <div>
            <span className="font-medium text-muted-foreground">Rating:</span>
          </div>
          <div>{data.rating ? `${data.rating}/100` : 'Not rated'}</div>
        </div>
      </CardContent>
    </Card>
  );
}