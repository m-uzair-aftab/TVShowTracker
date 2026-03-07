import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
interface SeasonProgressData {
  id?: number;
  watchlistId?: number;
  seasonNumber: number;
  startDate?: string | null;
  finishDate?: string | null;
  grade?: string | null;
  rating?: number | null;
}

interface SeasonProgressFormProps {
  seasonNumber: number;
  initialData?: SeasonProgressData;
  onSave: (data: Partial<SeasonProgressData>) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

// Parse a YYYY-MM-DD string as a local-time Date (avoids UTC midnight → previous day in local TZ)
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to calculate grade based on rating
function calculateGrade(rating: number | null): string | null {
  if (rating === null || rating === 0) return null;
  
  if (rating >= 90) return "A+";
  if (rating >= 85 && rating < 90) return "A";
  if (rating >= 75 && rating < 85) return "A-";
  if (rating >= 65 && rating < 75) return "B+";
  if (rating >= 55 && rating < 65) return "B";
  if (rating >= 45 && rating < 55) return "B-";
  if (rating >= 40 && rating < 45) return "C";
  if (rating >= 30 && rating < 40) return "C-";
  if (rating >= 10 && rating < 30) return "D";
  if (rating < 10) return "E";
  
  return null;
}

export function SeasonProgressForm({ 
  seasonNumber,
  initialData,
  onSave,
  onCancel,
  isSaving = false
}: SeasonProgressFormProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialData?.startDate ? parseDateLocal(initialData.startDate) : undefined
  );
  const [finishDate, setFinishDate] = useState<Date | undefined>(
    initialData?.finishDate ? parseDateLocal(initialData.finishDate) : undefined
  );
  const [rating, setRating] = useState<string>(
    initialData?.rating ? initialData.rating.toString() : ''
  );
  
  // Calculate grade based on rating (will be updated automatically)
  const ratingNum = rating ? parseInt(rating, 10) : null;
  const calculatedGrade = calculateGrade(ratingNum && !isNaN(ratingNum) ? ratingNum : null);
  
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [finishDateOpen, setFinishDateOpen] = useState(false);
  
  // Add state for manual date inputs
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [finishDateInput, setFinishDateInput] = useState<string>('');
  const [startDateError, setStartDateError] = useState<string>('');
  const [finishDateError, setFinishDateError] = useState<string>('');
  
  // Update manual inputs when dates change
  useEffect(() => {
    if (startDate) {
      setStartDateInput(format(startDate, 'MM/dd/yyyy'));
    } else {
      setStartDateInput('');
    }
  }, [startDate]);
  
  useEffect(() => {
    if (finishDate) {
      setFinishDateInput(format(finishDate, 'MM/dd/yyyy'));
    } else {
      setFinishDateInput('');
    }
  }, [finishDate]);
  
  // Date format validation function
  const isValidDateFormat = (dateString: string): boolean => {
    // Basic regex for MM/DD/YYYY format
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!regex.test(dateString)) return false;
    
    // Further validate the date is real (e.g., not 02/31/2024)
    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getMonth() === month - 1 && 
           date.getDate() === day && 
           date.getFullYear() === year;
  };
  
  // Handle manual date submission
  const handleStartDateSubmit = () => {
    if (!isValidDateFormat(startDateInput)) {
      setStartDateError('Please enter a valid date (MM/DD/YYYY)');
      return;
    }
    
    setStartDateError('');
    const [month, day, year] = startDateInput.split('/').map(Number);
    const newDate = new Date(year, month - 1, day);
    
    setStartDate(newDate);
    setStartDateOpen(false);
  };
  
  const handleFinishDateSubmit = () => {
    if (!isValidDateFormat(finishDateInput)) {
      setFinishDateError('Please enter a valid date (MM/DD/YYYY)');
      return;
    }
    
    setFinishDateError('');
    const [month, day, year] = finishDateInput.split('/').map(Number);
    const newDate = new Date(year, month - 1, day);
    
    setFinishDate(newDate);
    setFinishDateOpen(false);
  };
  
  const handleSave = () => {
    const ratingNum = rating ? parseInt(rating, 10) : undefined;
    
    // Validate rating range
    if (ratingNum !== undefined && (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 100)) {
      alert('Rating must be between 1 and 100');
      return;
    }
    
    // Calculate grade based on rating
    const gradeValue = calculateGrade(ratingNum || null);
    
    onSave({
      seasonNumber,
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      finishDate: finishDate ? format(finishDate, 'yyyy-MM-dd') : null,
      grade: gradeValue,
      rating: ratingNum || null
    });
  };
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Season {seasonNumber}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div>
                    <div className="p-2 border-b">
                      <Button 
                        variant="ghost" 
                        className="w-full text-destructive" 
                        onClick={() => {
                          setStartDate(undefined);
                          setStartDateInput('');
                          setStartDateOpen(false);
                        }}
                      >
                        Clear date
                      </Button>
                    </div>
                    
                    {/* Manual date input section */}
                    <div className="p-3 border-b">
                      <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Enter date (MM/DD/YYYY)</label>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="MM/DD/YYYY"
                            value={startDateInput}
                            onChange={(e) => setStartDateInput(e.target.value)}
                            className="text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleStartDateSubmit();
                              }
                            }}
                          />
                          <Button 
                            size="sm" 
                            onClick={handleStartDateSubmit}
                          >
                            Apply
                          </Button>
                        </div>
                        {startDateError && (
                          <p className="text-xs text-destructive">{startDateError}</p>
                        )}
                      </div>
                    </div>
                    
                    <Calendar
                      mode="single"
                      selected={startDate}
                      defaultMonth={startDate || undefined}
                      onSelect={(date) => {
                        setStartDate(date);
                        setStartDateOpen(false);
                      }}
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Finish Date</label>
              <Popover open={finishDateOpen} onOpenChange={setFinishDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {finishDate ? format(finishDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div>
                    <div className="p-2 border-b">
                      <Button 
                        variant="ghost" 
                        className="w-full text-destructive" 
                        onClick={() => {
                          setFinishDate(undefined);
                          setFinishDateInput('');
                          setFinishDateOpen(false);
                        }}
                      >
                        Clear date
                      </Button>
                    </div>
                    
                    {/* Manual date input section */}
                    <div className="p-3 border-b">
                      <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Enter date (MM/DD/YYYY)</label>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="MM/DD/YYYY"
                            value={finishDateInput}
                            onChange={(e) => setFinishDateInput(e.target.value)}
                            className="text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleFinishDateSubmit();
                              }
                            }}
                          />
                          <Button 
                            size="sm" 
                            onClick={handleFinishDateSubmit}
                          >
                            Apply
                          </Button>
                        </div>
                        {finishDateError && (
                          <p className="text-xs text-destructive">{finishDateError}</p>
                        )}
                      </div>
                    </div>
                    
                    <Calendar
                      mode="single"
                      selected={finishDate}
                      defaultMonth={finishDate || undefined}
                      onSelect={(date) => {
                        setFinishDate(date);
                        setFinishDateOpen(false);
                      }}
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating (1-100)</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="Enter rating"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Grade (Automatic)</label>
              <div className="h-10 px-3 py-2 border rounded-md flex items-center">
                {calculatedGrade ? (
                  <Badge className="bg-primary-light text-primary-dark">
                    {calculatedGrade}
                  </Badge>
                ) : (
                  <span className="text-gray-400">Based on rating</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end mt-4 space-x-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}